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
  useWriteLeverageZapLeverage,
} from "@/lib/generated";
import { CONTRACTS, USDG_DECIMALS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
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

/// One-click leveraged long (BUILD.md §11 Milestone 1): supply wNVDAx,
/// borrow USDG against it, swap that into more wNVDAx, supply that too --
/// one confirmation instead of four manual transactions. Needs a one-time
/// "Enable Leverage" authorization first (Market.setOperator) since
/// Market.supplyFor()/borrowFor() only credit the real user's position when
/// they've explicitly allowed this contract to act on their behalf.
export function LeveragePanel() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [intensity, setIntensity] = useState(50); // % of available borrowing power to use in this loop
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

  const parsedInitial = useMemo(() => {
    if (!amount) return 0n;
    try {
      return parseUnits(amount, WNVDAX_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  // Mirrors Market._collateralValueWad / _maxBorrowableNative exactly, so
  // the preview below matches what the contract will actually enforce --
  // see src/core/Market.sol for the source of truth this replicates.
  const preview = useMemo(() => {
    if (price === undefined || maxLtv === undefined || liquidationThreshold === undefined || feeWad === undefined) return null;

    const collateralAfterInitial = existingCollateral + parsedInitial;
    const collateralValueWad = (toWad(collateralAfterInitial, WNVDAX_DECIMALS) * price) / WAD;
    const maxBorrowWad = (collateralValueWad * maxLtv) / WAD;
    const maxBorrowNative = fromWad(maxBorrowWad, USDG_DECIMALS);
    const availableToBorrow = maxBorrowNative > existingDebt ? maxBorrowNative - existingDebt : 0n;
    const borrowAmount = (availableToBorrow * BigInt(intensity)) / 100n;

    const debtWad = toWad(borrowAmount, USDG_DECIMALS);
    const swappedCollateralWad = price === 0n ? 0n : (debtWad * (WAD - feeWad)) / price; // wNVDAx is 18 decimals -- no fromWad needed
    const projectedCollateral = collateralAfterInitial + swappedCollateralWad;
    const projectedDebt = existingDebt + borrowAmount;

    const projectedCollateralValueWad = (toWad(projectedCollateral, WNVDAX_DECIMALS) * price) / WAD;
    const projectedDebtWad = toWad(projectedDebt, USDG_DECIMALS);
    const projectedHealthFactor =
      projectedDebtWad === 0n ? MAX_UINT256 : (projectedCollateralValueWad * liquidationThreshold) / projectedDebtWad;

    const minCollateralOut = (swappedCollateralWad * 99n) / 100n; // 1% slippage floor against a mid-flight fee change

    return { borrowAmount, swappedCollateral: swappedCollateralWad, projectedCollateral, projectedDebt, projectedHealthFactor, minCollateralOut };
  }, [price, maxLtv, liquidationThreshold, feeWad, existingCollateral, existingDebt, parsedInitial, intensity]);

  const needsApproval = parsedInitial > 0n && (allowance ?? 0n) < parsedInitial;

  const enableOp = useWriteMarketSetOperator();
  const enableOpReceipt = useWaitForTransactionReceipt({ hash: enableOp.data });
  const approve = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approve.data });
  const leverage = useWriteLeverageZapLeverage();
  const leverageReceipt = useWaitForTransactionReceipt({ hash: leverage.data });

  const simulate = useSimulateContract({
    address: CONTRACTS.leverageZap,
    abi: leverageZapAbi,
    functionName: "leverage",
    args:
      preview && preview.borrowAmount > 0n
        ? [CONTRACTS.market, CONTRACTS.swapModule, parsedInitial, preview.borrowAmount, preview.minCollateralOut]
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
      args: [CONTRACTS.market, CONTRACTS.swapModule, parsedInitial, preview.borrowAmount, preview.minCollateralOut],
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

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Leverage</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Supply, borrow, and swap into more wNVDAx -- one confirmation instead of separate supply/borrow/swap/supply steps.
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
            <span>Leverage intensity</span>
            <span className="font-medium text-[var(--color-text)]">{intensity}% of available borrowing power</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--color-accent)]"
          />

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
