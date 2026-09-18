"use client";

import { useReadHaltControllerState, useReadHaltControllerSettlementAvailableAt } from "@/lib/generated";
import { CONTRACTS } from "@/lib/contracts";

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

/// Turns the settlement deadline into something concrete. A guarantee that
/// capital can't be locked up forever is only reassuring if you can see when
/// it kicks in.
function settlementCountdown(availableAt: bigint | undefined): string | null {
  if (availableAt === undefined || availableAt === 0n) return null;
  const secondsLeft = Number(availableAt) - Math.floor(Date.now() / 1000);
  if (secondsLeft <= 0) return "Settlement can be triggered now by anyone.";

  const hours = Math.ceil(secondsLeft / 3600);
  if (hours < 48) return `Lender settlement unlocks in ~${hours}h if this doesn't resolve.`;
  return `Lender settlement unlocks in ~${Math.ceil(hours / 24)}d if this doesn't resolve.`;
}

export function HaltStatusBanner() {
  const { data: state, isLoading } = useReadHaltControllerState({
    address: CONTRACTS.haltController,
    query: { refetchInterval: 6_000 },
  });
  const { data: settlementAvailableAt } = useReadHaltControllerSettlementAvailableAt({
    address: CONTRACTS.haltController,
    query: { refetchInterval: 30_000 },
  });

  if (isLoading || state === undefined) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text-faint)]">
        <span className="h-2 w-2 rounded-full bg-[var(--color-text-faint)] animate-pulse" />
        Checking market status...
      </div>
    );
  }

  const label = STATE_LABEL[state] ?? "OPEN";
  const config = STATE_CONFIG[label];
  // Only meaningful while the market is restricted but not yet settled --
  // once it's SETTLING the deadline has already passed, and when it's OPEN
  // there's no clock running at all.
  const countdown =
    label === "HALTING" || label === "HALTED" || label === "RESUMING" ? settlementCountdown(settlementAvailableAt) : null;

  return (
    <div className={`flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] ${config.bg} px-4 py-3`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${config.dot}`} />
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <span className={`text-sm font-semibold ${config.text}`}>{label}</span>
          <span className="text-sm text-[var(--color-text-muted)]">{config.message}</span>
        </div>
        {countdown && <p className="mt-1 text-xs text-[var(--color-text-faint)]">{countdown}</p>}
      </div>
    </div>
  );
}
