"use client";

import { useReadHaltControllerState } from "@/lib/generated";
import { CONTRACTS } from "@/lib/contracts";

// Mirrors HaltController.MarketState exactly (src/core/HaltController.sol).
const STATE_LABEL = ["OPEN", "HALTING", "HALTED", "RESUMING"] as const;

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
} as const;

export function HaltStatusBanner() {
  const { data: state, isLoading } = useReadHaltControllerState({
    address: CONTRACTS.haltController,
    query: { refetchInterval: 6_000 },
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

  return (
    <div className={`flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] ${config.bg} px-4 py-3`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${config.dot}`} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
        <span className={`text-sm font-semibold ${config.text}`}>{label}</span>
        <span className="text-sm text-[var(--color-text-muted)]">{config.message}</span>
      </div>
    </div>
  );
}
