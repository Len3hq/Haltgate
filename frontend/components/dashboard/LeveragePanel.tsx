"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSimulateContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { erc20Abi, parseUnits } from "viem";
import {
  leverageZapAbi,
  useReadMarketGetPosition,
  useReadMarketMaxLtv,
  useReadMarketLiquidationThreshold,
  useReadMarketIsOperator,
  useReadHaltControllerCanSupplyOrBorrow,
  useReadIPausableOracleLatestPrice,
  useReadSwapModuleFeeWad,
  useWriteMarketSetOperator,
  useWriteLeverageZapMultiply,
} from "@/lib/generated";
import { CONTRACTS, USDG_DECIMALS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { formatAmount, formatBps, formatPrice } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { TxStatus } from "@/components/dashboard/TxStatus";

const WAD = 10n ** 18n;
const MAX_UINT256 = (1n << 256n) - 1n;

function toWad(amount: bigint, decimals: number): bigint {
  return decimals === 18 ? amount : amount * 10n ** BigInt(18 - decimals);
}

function fromWad(amountWad: bigint, decimals: number): bigint {
  return decimals === 18 ? amountWad : amountWad / 10n ** BigInt(18 - decimals);
}

/// One-click leveraged long (BUILD.md §11 Milestones 1-2): supply wNVDAx,
/// then loop borrow -> swap -> supply until the position reaches the chosen
/// multiple -- one confirmation instead of repeating four manual steps.
/// Needs a one-time "Enable Leverage" authorization first
/// (Market.setOperator) since Market.supplyFor()/borrowFor() only credit the
/// real user's position when they've explicitly allowed this contract to act
/// on their behalf.
export function LeveragePanel() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [targetLeverage, setTargetLeverage] = useState(1.5); // multiple, e.g. 1.5x
  const queryClient = useQueryClient();

  const { data: canSupplyOrBorrow } = useReadHaltControllerCanSupplyOrBorrow({
    address: CONTRACTS.haltController,
    query: { refetchInterval: 6_000 },
  });

  const { data: isOperator, refetch: refetchIsOperator } = useReadMarketIsOperator({
    address: CONTRACTS.market,
    args: address ? [address, CONTRACTS.leverageZap] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });

  const { data: walletBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.wNVDAx,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.wNVDAx,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.leverageZap] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });

  const { data: position, refetch: refetchPosition } = useReadMarketGetPosition({
    address: CONTRACTS.market,
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });
  const existingCollateral = position?.[0] ?? 0n;
  const existingDebt = position?.[1] ?? 0n;

  const { data: maxLtv } = useReadMarketMaxLtv({ address: CONTRACTS.market });
  const { data: liquidationThreshold } = useReadMarketLiquidationThreshold({ address: CONTRACTS.market });
  const { data: priceData } = useReadIPausableOracleLatestPrice({ address: CONTRACTS.oracle, query: { refetchInterval: 10_000 } });
  const { data: feeWad } = useReadSwapModuleFeeWad({ address: CONTRACTS.swapModule });
  const price = priceData?.[0];

  // What the loop can actually draw on -- the vault's liquid cash is usually
  // what stops it before the LTV ceiling does.
  const { data: vaultCash } = useReadContract({
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [CONTRACTS.lenderVault],
    query: { refetchInterval: 8_000 },
  });

  // A market's maxLTV caps achievable leverage at 1 / (1 - maxLTV) -- 2x at a
  // 50% LTV. That's an asymptote no finite number of loops reaches, so the
  // slider stops short of it rather than offering a multiple that can never
  // actually be filled.
  const maxSelectable = useMemo(() => {
    if (maxLtv === undefined || maxLtv >= WAD) return 1.5;
    const theoretical = Number(WAD) / Number(WAD - maxLtv);
    return Math.max(1.05, Math.floor((1 + (theoretical - 1) * 0.95) * 20) / 20); // round down to a 0.05 step
  }, [maxLtv]);

  const effectiveTarget = Math.min(targetLeverage, maxSelectable);

  const parsedInitial = useMemo(() => {
    if (!amount) return 0n;
    try {
      return parseUnits(amount, WNVDAX_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  // Mirrors what LeverageZap.multiply() will actually do on-chain: work out
  // the collateral gap to the requested multiple, price it back into debt
  // through SwapModule's own formula, then cap it the same way the loop does
  // -- by the position's LTV headroom and the vault's liquid cash. See
  // src/periphery/LeverageZap.sol for the source of truth this replicates.
  const preview = useMemo(() => {
    if (price === undefined || price === 0n || maxLtv === undefined || liquidationThreshold === undefined || feeWad === undefined) {
      return null;
    }

    const baseCollateral = existingCollateral + parsedInitial;
    const targetWad = BigInt(Math.round(effectiveTarget * 1e6)) * 10n ** 12n; // 1.55 -> 1.55e18, no float dust
    const targetCollateral = (baseCollateral * targetWad) / WAD;
    const gap = targetCollateral > baseCollateral ? targetCollateral - baseCollateral : 0n;

    // Inverse of SwapModule's collateralWad = debtWad * (WAD - fee) / price.
    const debtForGap = fromWad((toWad(gap, WNVDAX_DECIMALS) * price) / (WAD - feeWad), USDG_DECIMALS);

    const collateralValueWad = (toWad(baseCollateral, WNVDAX_DECIMALS) * price) / WAD;
    const maxDebt = fromWad((collateralValueWad * maxLtv) / WAD, USDG_DECIMALS);
    const headroom = maxDebt > existingDebt ? maxDebt - existingDebt : 0n;

    let borrowAmount = debtForGap < headroom ? debtForGap : headroom;
    const cash = vaultCash ?? 0n;
    const liquidityCapped = borrowAmount > cash;
    if (liquidityCapped) borrowAmount = cash;

    const swappedCollateral = (toWad(borrowAmount, USDG_DECIMALS) * (WAD - feeWad)) / price;
    const projectedCollateral = baseCollateral + swappedCollateral;
    const projectedDebt = existingDebt + borrowAmount;

    const projectedCollateralValueWad = (toWad(projectedCollateral, WNVDAX_DECIMALS) * price) / WAD;
    const projectedDebtWad = toWad(projectedDebt, USDG_DECIMALS);
    const projectedHealthFactor =
      projectedDebtWad === 0n ? MAX_UINT256 : (projectedCollateralValueWad * liquidationThreshold) / projectedDebtWad;

    // The price wNVDAx would have to fall to before this position becomes
    // liquidatable -- the inversion of Market.isLiquidatable's own condition
    // (debtWad > collateralValue * liquidationThreshold) solved for price.
    // For a directional leveraged position this is the number that actually
    // says whether the bet is survivable; a health factor alone doesn't.
    let liquidationPrice: bigint | null = null;
    let dropToLiquidationPct: number | null = null;
    if (projectedDebtWad > 0n && projectedCollateral > 0n) {
      liquidationPrice =
        (projectedDebtWad * WAD * WAD) / (toWad(projectedCollateral, WNVDAX_DECIMALS) * liquidationThreshold);
      dropToLiquidationPct =
        liquidationPrice >= price ? 0 : Number(((price - liquidationPrice) * 10_000n) / price) / 100;
    }

    // Floor passed to the contract: 1% under the projection, so ordinary
    // rounding doesn't revert a good transaction while a materially
    // under-delivered one still does.
    const minFinalCollateral = (projectedCollateral * 99n) / 100n;

    return {
      targetWad,
      borrowAmount,
      projectedCollateral,
      projectedDebt,
      projectedHealthFactor,
      minFinalCollateral,
      liquidityCapped,
      liquidationPrice,
      dropToLiquidationPct,
    };
  }, [price, maxLtv, liquidationThreshold, feeWad, vaultCash, existingCollateral, existingDebt, parsedInitial, effectiveTarget]);

  const needsApproval = parsedInitial > 0n && (allowance ?? 0n) < parsedInitial;

  const enableOp = useWriteMarketSetOperator();
  const enableOpReceipt = useWaitForTransactionReceipt({ hash: enableOp.data });
  const approve = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approve.data });
  const leverage = useWriteLeverageZapMultiply();
  const leverageReceipt = useWaitForTransactionReceipt({ hash: leverage.data });

  const simulate = useSimulateContract({
    address: CONTRACTS.leverageZap,
    abi: leverageZapAbi,
    functionName: "multiply",
    args:
      preview && preview.borrowAmount > 0n
        ? [CONTRACTS.market, CONTRACTS.swapModule, parsedInitial, preview.targetWad, preview.minFinalCollateral]
        : undefined,
    query: { enabled: !!address && isOperator === true && !needsApproval && !!preview && preview.borrowAmount > 0n },
  });
  const simulationActive = isOperator === true && !needsApproval && !!preview && preview.borrowAmount > 0n;
  const simulationPending = simulationActive && simulate.isPending;
  const simulationBlocked = simulationActive && !simulate.isPending && !!simulate.error;

  useEffect(() => {
    if (enableOpReceipt.isSuccess) refetchIsOperator();
  }, [enableOpReceipt.isSuccess, refetchIsOperator]);
  useEffect(() => {
    if (approveReceipt.isSuccess) refetchAllowance();
  }, [approveReceipt.isSuccess, refetchAllowance]);
  useEffect(() => {
    if (leverageReceipt.isSuccess) {
      setAmount("");
      refetchBalance();
      refetchAllowance();
      refetchPosition();
      queryClient.invalidateQueries();
    }
  }, [leverageReceipt.isSuccess, refetchBalance, refetchAllowance, refetchPosition, queryClient]);

  function handleEnable() {
    enableOp.writeContract({ address: CONTRACTS.market, args: [CONTRACTS.leverageZap, true] });
  }
  function handleApprove() {
    approve.writeContract({ address: CONTRACTS.wNVDAx, abi: erc20Abi, functionName: "approve", args: [CONTRACTS.leverageZap, parsedInitial] });
  }
  function handleLeverage() {
    if (!preview) return;
    leverage.writeContract({
      address: CONTRACTS.leverageZap,
      args: [CONTRACTS.market, CONTRACTS.swapModule, parsedInitial, preview.targetWad, preview.minFinalCollateral],
    });
  }
  function handleMax() {
    if (walletBalance === undefined) return;
    const divisor = 10n ** BigInt(WNVDAX_DECIMALS);
    const whole = walletBalance / divisor;
    const frac = walletBalance % divisor;
    setAmount(frac === 0n ? whole.toString() : `${whole}.${frac.toString().padStart(WNVDAX_DECIMALS, "0")}`.replace(/0+$/, "").replace(/\.$/, ""));
  }

  if (!isConnected) return null;

  const isBusy = enableOp.isPending || enableOpReceipt.isLoading || approve.isPending || approveReceipt.isLoading || leverage.isPending || leverageReceipt.isLoading;
  const hfDisplay = !preview ? "--" : preview.projectedHealthFactor === MAX_UINT256 ? "∞" : (Number(preview.projectedHealthFactor) / 1e18).toFixed(2);

  // How much room the price has before liquidation, not the multiple itself,
  // is what decides whether this position is comfortable to hold -- so the
  // tone keys off that distance rather than off the leverage chosen.
  const drop = preview?.dropToLiquidationPct ?? 100;
  const liqTone =
    drop < 15
      ? { bg: "var(--color-error-bg)", text: "var(--color-error)" }
      : drop < 30
        ? { bg: "var(--color-warning-bg)", text: "var(--color-warning)" }
        : { bg: "var(--color-bg-elevated)", text: "var(--color-text-muted)" };

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Leverage</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Pick a multiple and the loop runs itself -- borrow, swap into more wNVDAx, supply, repeat -- in one confirmation.
      </p>

      {canSupplyOrBorrow === false && (
        <p className="mt-3 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
          Market isn&apos;t open for leverage right now -- see the status banner above.
        </p>
      )}

      {isOperator !== true ? (
        <div className="mt-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            One-time authorization: let Leverage act on your position so the loop can credit you, not itself. Revocable anytime.
          </p>
          <button
            onClick={handleEnable}
            disabled={enableOp.isPending || enableOpReceipt.isLoading}
            className="mt-3 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
          >
            {enableOp.isPending || enableOpReceipt.isLoading ? "Confirming..." : "Enable Leverage"}
          </button>
          <TxStatus
            hash={enableOp.data}
            isPending={enableOp.isPending}
            isConfirming={enableOpReceipt.isLoading}
            isSuccess={enableOpReceipt.isSuccess}
            error={enableOp.error}
            successLabel="Enabled -- set an amount below."
          />
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>Initial deposit (wNVDAx)</span>
            <span>
              Balance: {formatAmount(walletBalance, WNVDAX_DECIMALS)}{" "}
              <button onClick={handleMax} className="text-[var(--color-accent)] hover:underline">
                Max
              </button>
            </span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="mt-1 w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-lg text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />

          <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>Target leverage</span>
            <span className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
              {effectiveTarget.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={1.05}
            max={maxSelectable}
            step={0.05}
            value={effectiveTarget}
            onChange={(e) => setTargetLeverage(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--color-accent)]"
          />
          <div className="mt-1 flex justify-between text-[10px] text-[var(--color-text-faint)]">
            <span>1.05x</span>
            <span>{maxSelectable.toFixed(2)}x max at {formatBps(maxLtv)} LTV</span>
          </div>

          {preview?.liquidityCapped && (
            <p className="mt-3 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
              Not enough USDG is liquid right now to reach {effectiveTarget.toFixed(2)}x -- the loop will stop early at roughly{" "}
              {formatAmount(preview.projectedCollateral, WNVDAX_DECIMALS)} wNVDAx instead of reverting.
            </p>
          )}

          {preview && preview.borrowAmount > 0n && (
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] p-3 text-center text-xs">
              <div>
                <p className="text-[var(--color-text-faint)]">You borrow</p>
                <p className="mt-0.5 font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
                  {formatAmount(preview.borrowAmount, USDG_DECIMALS)}{" "}
                  <span className="text-[10px] font-normal text-[var(--color-text-muted)]">USDG</span>
                </p>
              </div>
              <div>
                <p className="text-[var(--color-text-faint)]">Collateral after</p>
                <p className="mt-0.5 font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
                  {formatAmount(preview.projectedCollateral, WNVDAX_DECIMALS)}{" "}
                  <span className="text-[10px] font-normal text-[var(--color-text-muted)]">wNVDAx</span>
                </p>
              </div>
              <div>
                <p className="text-[var(--color-text-faint)]">Health factor</p>
                <p className="mt-0.5 font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
                  {hfDisplay}{" "}
                  <span className="text-[10px] font-normal text-[var(--color-text-muted)]">liq. at 1.00</span>
                </p>
              </div>
            </div>
          )}

          {preview && preview.borrowAmount > 0n && preview.liquidationPrice !== null && (
            <div
              className="mt-2 flex items-center justify-between rounded-[var(--radius-card)] px-3 py-2.5 text-xs"
              style={{ background: liqTone.bg, color: liqTone.text }}
            >
              <span>Liquidation price</span>
              <span className="font-[family-name:var(--font-display)] font-semibold">
                ${formatPrice(preview.liquidationPrice)}
                {preview.dropToLiquidationPct !== null && (
                  <span className="ml-1.5 text-[10px] font-normal opacity-80">
                    {preview.dropToLiquidationPct.toFixed(1)}% below today
                  </span>
                )}
              </span>
            </div>
          )}

          {needsApproval ? (
            <>
              <button
                onClick={handleApprove}
                disabled={parsedInitial === 0n || approve.isPending || approveReceipt.isLoading}
                className="mt-3 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
              >
                {approve.isPending || approveReceipt.isLoading ? "Approving..." : "Approve wNVDAx"}
              </button>
              <TxStatus
                hash={approve.data}
                isPending={approve.isPending}
                isConfirming={approveReceipt.isLoading}
                isSuccess={approveReceipt.isSuccess}
                error={approve.error}
                pendingLabel="Confirm approval in wallet..."
                successLabel="Approved -- you can now leverage below."
              />
            </>
          ) : (
            <>
              <button
                onClick={handleLeverage}
                disabled={!preview || preview.borrowAmount === 0n || isBusy || canSupplyOrBorrow === false || simulationPending || simulationBlocked}
                className="mt-3 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
              >
                {isBusy ? "Confirming..." : simulationPending ? "Checking..." : "Leverage"}
              </button>
              {simulationBlocked && (
                <p className="mt-2 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
                  {getErrorMessage(simulate.error)}
                </p>
              )}
              <TxStatus
                hash={leverage.data}
                isPending={leverage.isPending}
                isConfirming={leverageReceipt.isLoading}
                isSuccess={leverageReceipt.isSuccess}
                error={leverage.error}
                successLabel="Leveraged."
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
