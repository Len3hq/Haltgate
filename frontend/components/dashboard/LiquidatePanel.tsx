"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSimulateContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { erc20Abi, parseUnits, isAddress, type Address } from "viem";
import {
  marketAbi,
  useReadMarketIsLiquidatable,
  useReadMarketHealthFactor,
  useReadHaltControllerCanLiquidate,
  useReadMarketIsFixedDefaulted,
  useReadMarketFixedLoans,
  useReadMarketSettlementBounty,
  useWriteMarketLiquidate,
  useWriteMarketSettleMatured,
} from "@/lib/generated";
import { USDG_DECIMALS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { formatAmount, formatBps } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { TxStatus } from "@/components/dashboard/TxStatus";
import { useMarketContracts } from "@/lib/market-context";
import { InfoTip } from "@/components/dashboard/InfoTip";

const MAX_UINT256 = (1n << 256n) - 1n;

export function LiquidatePanel() {
  const CONTRACTS = useMarketContracts();
  const { address: connected } = useAccount();
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const queryClient = useQueryClient();

  const targetAddress = isAddress(target) ? (target as Address) : undefined;

  const { data: canLiquidate } = useReadHaltControllerCanLiquidate({
    address: CONTRACTS.haltController,
    query: { refetchInterval: 6_000 },
  });
  const { data: isLiquidatable } = useReadMarketIsLiquidatable({
    address: CONTRACTS.market,
    args: targetAddress ? [targetAddress] : undefined,
    query: { enabled: !!targetAddress, refetchInterval: 6_000 },
  });
  const { data: healthFactor } = useReadMarketHealthFactor({
    address: CONTRACTS.market,
    args: targetAddress ? [targetAddress] : undefined,
    query: { enabled: !!targetAddress, refetchInterval: 6_000 },
  });

  const { data: isFixedDefaulted } = useReadMarketIsFixedDefaulted({
    address: CONTRACTS.market,
    args: targetAddress ? [targetAddress] : undefined,
    query: { enabled: !!targetAddress, refetchInterval: 8_000 },
  });
  const { data: fixedLoan } = useReadMarketFixedLoans({
    address: CONTRACTS.market,
    args: targetAddress ? [targetAddress] : undefined,
    query: { enabled: !!targetAddress, refetchInterval: 8_000 },
  });
  const { data: settlementBounty } = useReadMarketSettlementBounty({ address: CONTRACTS.market });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "allowance",
    args: connected ? [connected, CONTRACTS.market] : undefined,
    query: { enabled: !!connected, refetchInterval: 8_000 },
  });

  const parsedAmount = useMemo(() => {
    if (!amount) return 0n;
    try {
      return parseUnits(amount, USDG_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  const needsApproval = (allowance ?? 0n) < parsedAmount;

  // Same reasoning as ActionPanel: catch reverts (stale oracle, close-factor
  // edge cases, etc.) ourselves before the wallet's own pre-flight gas
  // estimation blocks the user with an undecoded generic error.
  const simulate = useSimulateContract({
    address: CONTRACTS.market,
    abi: marketAbi,
    functionName: "liquidate",
    args: targetAddress ? [targetAddress, parsedAmount] : undefined,
    query: { enabled: !!targetAddress && parsedAmount > 0n && !needsApproval },
  });
  const simulationActive = !!targetAddress && parsedAmount > 0n && !needsApproval;
  // See ActionPanel: isPending stays true for a query that hasn't run yet,
  // so the button must stay disabled through that whole window too, not
  // just once an error lands -- otherwise a fast click can beat the check.
  const simulationPending = simulationActive && simulate.isPending;
  const simulationBlocked = simulationActive && !simulate.isPending && !!simulate.error;

  const approve = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approve.data });
  const liquidate = useWriteMarketLiquidate();
  const liquidateReceipt = useWaitForTransactionReceipt({ hash: liquidate.data });
  const settle = useWriteMarketSettleMatured();
  const settleReceipt = useWaitForTransactionReceipt({ hash: settle.data });

  useEffect(() => {
    if (approveReceipt.isSuccess) refetchAllowance();
  }, [approveReceipt.isSuccess, refetchAllowance]);
  useEffect(() => {
    if (liquidateReceipt.isSuccess || settleReceipt.isSuccess) {
      setAmount("");
      queryClient.invalidateQueries();
    }
  }, [liquidateReceipt.isSuccess, settleReceipt.isSuccess, queryClient]);

  function handleApprove() {
    approve.writeContract({ address: CONTRACTS.usdg, abi: erc20Abi, functionName: "approve", args: [CONTRACTS.market, parsedAmount] });
  }

  function handleLiquidate() {
    if (!targetAddress) return;
    liquidate.writeContract({ address: CONTRACTS.market, args: [targetAddress, parsedAmount] });
  }

  const hfDisplay = healthFactor === undefined ? "—" : healthFactor === MAX_UINT256 ? "No debt" : (Number(healthFactor) / 1e18).toFixed(2);
  const isBusy = approve.isPending || approveReceipt.isLoading || liquidate.isPending || liquidateReceipt.isLoading;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Liquidate a Position</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Anyone can liquidate an undercollateralized position — repay some of its debt, receive its collateral at a discount.
      </p>

      <input
        type="text"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="Address to check (0x...)"
        className="mt-3 w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
      />

      {targetAddress && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-[var(--color-text-muted)]">Health factor: {hfDisplay}</span>
          <span className={isLiquidatable ? "text-[var(--color-error)]" : "text-[var(--color-success)]"}>
            {isLiquidatable ? "Liquidatable" : "Healthy"}
          </span>
        </div>
      )}

      {canLiquidate === false && (
        <p className="mt-2 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
          Liquidations are paused right now — see the status banner above.
        </p>
      )}

      {targetAddress && isLiquidatable && (
        <div className="mt-3">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount to repay (USDG)"
            className="w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />
          {needsApproval ? (
            <>
              <button
                onClick={handleApprove}
                disabled={parsedAmount === 0n || isBusy}
                className="mt-2 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
              >
                {isBusy ? "Approving..." : "Approve USDG"}
              </button>
              <TxStatus
                hash={approve.data}
                isPending={approve.isPending}
                isConfirming={approveReceipt.isLoading}
                isSuccess={approveReceipt.isSuccess}
                error={approve.error}
                pendingLabel="Confirm approval in wallet..."
                successLabel="Approved — you can now liquidate below."
              />
            </>
          ) : (
            <>
              <button
                onClick={handleLiquidate}
                disabled={parsedAmount === 0n || isBusy || canLiquidate === false || simulationPending || simulationBlocked}
                className="mt-2 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
              >
                {isBusy ? "Confirming..." : simulationPending ? "Checking..." : "Liquidate"}
              </button>
              {simulationBlocked && (
                <p className="mt-2 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
                  {getErrorMessage(simulate.error)}
                </p>
              )}
              <TxStatus
                hash={liquidate.data}
                isPending={liquidate.isPending}
                isConfirming={liquidateReceipt.isLoading}
                isSuccess={liquidateReceipt.isSuccess}
                error={liquidate.error}
                successLabel="Liquidated."
              />
            </>
          )}
        </div>
      )}

      {targetAddress && isFixedDefaulted && fixedLoan && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Matured Fixed-Term Loan</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            This address has a fixed-term loan past its end date. Fixed-term loans are never liquidated on price, so settling
            closes it out instead: the {formatAmount(fixedLoan[0], WNVDAX_DECIMALS)} collateral is claimed and the debt is
            written off. No price is read and you put up nothing.
          </p>
          {settlementBounty !== undefined && settlementBounty > 0n && (
            <p className="mt-2 flex items-baseline justify-between rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs">
              <span className="text-[var(--color-text-muted)]">
                You receive
                <InfoTip
                  align="left"
                  text="Settling a matured loan costs you nothing but gas, so the protocol pays a small share of the collateral to whoever closes it out. Without it nobody would be paid to settle and the pool would keep carrying a defaulted loan at full value."
                />
              </span>
              <span className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-success)]">
                {formatAmount((fixedLoan[0] * settlementBounty) / 10n ** 18n, WNVDAX_DECIMALS, 4)}{" "}
                <span className="text-[10px] font-normal">({formatBps(settlementBounty)})</span>
              </span>
            </p>
          )}
          <button
            onClick={() => settle.writeContract({ address: CONTRACTS.market, args: [targetAddress] })}
            disabled={isBusy || settle.isPending || settleReceipt.isLoading || canLiquidate === false}
            className="mt-3 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
          >
            {settle.isPending || settleReceipt.isLoading ? "Confirming..." : "Settle matured loan"}
          </button>
          <TxStatus
            hash={settle.data}
            isPending={settle.isPending}
            isConfirming={settleReceipt.isLoading}
            isSuccess={settleReceipt.isSuccess}
            error={settle.error}
            successLabel="Settled."
          />
        </div>
      )}
    </div>
  );
}
