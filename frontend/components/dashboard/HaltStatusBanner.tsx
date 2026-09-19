"use client";

import { useEffect } from "react";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import {
  useReadHaltControllerState,
  useReadHaltControllerSettlementAvailableAt,
  useSimulateHaltControllerForceSettle,
  useWriteHaltControllerForceSettle,
} from "@/lib/generated";

import { useNow } from "@/lib/use-now";
import { getErrorMessage } from "@/lib/errors";
import { TxStatus } from "@/components/dashboard/TxStatus";
import { useMarketContracts } from "@/lib/market-context";

// Mirrors HaltController.MarketState exactly (src/core/HaltController.sol).
const STATE_LABEL = ["OPEN", "HALTING", "HALTED", "RESUMING", "SETTLING"] as const;

const STATE_CONFIG = {
  OPEN: {
    dot: "bg-[var(--color-success)]",
    bg: "bg-[var(--color-success-bg)]",
    text: "text-[var(--color-success)]",
    message: "Market open. Supply, borrow, and repay are all available.",
  },
  HALTING: {
    dot: "bg-[var(--color-warning)]",
    bg: "bg-[var(--color-warning-bg)]",
    text: "text-[var(--color-warning)]",
    message: "A corporate action is approaching. New supply and borrow are paused; you can still repay.",
  },
  HALTED: {
    dot: "bg-[var(--color-error)]",
    bg: "bg-[var(--color-error-bg)]",
    text: "text-[var(--color-error)]",
    message: "Market halted for a corporate action in progress. Only repayment is available -- interest stops accruing on all debt until it resolves.",
  },
  RESUMING: {
    dot: "bg-[var(--color-accent-blue)]",
    bg: "bg-[var(--color-bg-elevated)]",
    text: "text-[var(--color-accent-blue)]",
    message: "Resuming after a corporate action. Verifying post-event prices before liquidations reopen.",
  },
  SETTLING: {
    dot: "bg-[var(--color-warning)]",
    bg: "bg-[var(--color-warning-bg)]",
    text: "text-[var(--color-warning)]",
    message:
      "This halt ran past its maximum duration. Borrowing and liquidation stay paused, but lenders can now withdraw their proportional share of available cash.",
  },
} as const;

/// A guarantee that capital can't be locked up forever only reassures if you
/// can see when it kicks in -- and act on it once it does.
function settlementStatus(availableAt: bigint | undefined, now: number): { message: string; unlocked: boolean } | null {
  if (availableAt === undefined || availableAt === 0n) return null;
  const secondsLeft = Number(availableAt) - now;
  if (secondsLeft <= 0) {
    return { message: "This halt has run past its limit. Anyone can now open settlement so lenders can withdraw.", unlocked: true };
  }
  const hours = Math.ceil(secondsLeft / 3600);
  const eta = hours < 48 ? `~${hours}h` : `~${Math.ceil(hours / 24)}d`;
  return { message: `Lender settlement unlocks in ${eta} if this doesn't resolve.`, unlocked: false };
}

export function HaltStatusBanner() {
  const CONTRACTS = useMarketContracts();
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const { data: state, isLoading } = useReadHaltControllerState({
    address: CONTRACTS.haltController,
    query: { refetchInterval: 6_000 },
  });
  const { data: settlementAvailableAt } = useReadHaltControllerSettlementAvailableAt({
    address: CONTRACTS.haltController,
    query: { refetchInterval: 30_000 },
  });

  const now = useNow();
  const label = state === undefined ? "OPEN" : (STATE_LABEL[state] ?? "OPEN");
  // Only runs while the market is restricted but not yet settled: once it's
  // SETTLING the deadline has passed, and when OPEN no clock is running.
  const settlement =
    label === "HALTING" || label === "HALTED" || label === "RESUMING" ? settlementStatus(settlementAvailableAt, now) : null;
  const canSettle = settlement?.unlocked === true;

  const simulate = useSimulateHaltControllerForceSettle({
    address: CONTRACTS.haltController,
    query: { enabled: !!address && canSettle },
  });
  const settle = useWriteHaltControllerForceSettle();
  const settleReceipt = useWaitForTransactionReceipt({ hash: settle.data });

  useEffect(() => {
    if (settleReceipt.isSuccess) queryClient.invalidateQueries();
  }, [settleReceipt.isSuccess, queryClient]);

  const simulationBlocked = !!address && canSettle && !simulate.isPending && !!simulate.error;
  const isBusy = settle.isPending || settleReceipt.isLoading;

  if (isLoading || state === undefined) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text-faint)]">
        <span className="h-2 w-2 rounded-full bg-[var(--color-text-faint)] animate-pulse" />
        Checking market status...
      </div>
    );
  }

  const config = STATE_CONFIG[label];

  return (
    <div className={`flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] ${config.bg} px-4 py-3`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${config.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <span className={`text-sm font-semibold ${config.text}`}>{label}</span>
          <span className="text-sm text-[var(--color-text-muted)]">{config.message}</span>
        </div>

        {settlement && (
          <div className="mt-2">
            <p className="text-xs text-[var(--color-text-faint)]">{settlement.message}</p>

            {canSettle && (
              <div className="mt-2">
                {address ? (
                  <>
                    <button
                      onClick={() => settle.writeContract({ address: CONTRACTS.haltController })}
                      disabled={isBusy || simulationBlocked}
                      className="rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-4 py-1.5 text-xs font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
                    >
                      {isBusy ? "Confirming..." : "Open settlement"}
                    </button>
                    <p className="mt-1.5 text-[11px] text-[var(--color-text-faint)]">
                      Permissionless -- any wallet can do this, and it unlocks withdrawals for every lender at once, not just you.
                      Borrowing and liquidation stay paused.
                    </p>
                    {simulationBlocked && (
                      <p className="mt-2 text-[11px] text-[var(--color-warning)]">{getErrorMessage(simulate.error)}</p>
                    )}
                    <TxStatus
                      hash={settle.data}
                      isPending={settle.isPending}
                      isConfirming={settleReceipt.isLoading}
                      isSuccess={settleReceipt.isSuccess}
                      error={settle.error}
                      successLabel="Settlement open -- lenders can now withdraw their pro-rata share."
                    />
                  </>
                ) : (
                  <p className="text-[11px] text-[var(--color-text-faint)]">
                    Connect a wallet to open settlement. Any wallet can -- it unlocks withdrawals for every lender at once.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
