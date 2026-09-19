"use client";

import Link from "next/link";
import { useReadHaltControllerState } from "@/lib/generated";
import { MARKETS, type MarketConfig } from "@/lib/contracts";

const STATE_LABEL = ["OPEN", "HALTING", "HALTED", "RESUMING", "SETTLING"] as const;

const DOT: Record<string, string> = {
  OPEN: "bg-[var(--color-success)]",
  HALTING: "bg-[var(--color-warning)]",
  HALTED: "bg-[var(--color-error)]",
  RESUMING: "bg-[var(--color-accent-blue)]",
  SETTLING: "bg-[var(--color-warning)]",
};

function Pill({ config, active }: { config: MarketConfig; active: boolean }) {
  const { data: state } = useReadHaltControllerState({
    address: config.haltController,
    query: { refetchInterval: 10_000 },
  });
  const label = state === undefined ? "OPEN" : (STATE_LABEL[state] ?? "OPEN");

  return (
    <Link
      href={`/app/${config.key}`}
      title={`${config.name} — ${label}`}
      className={`flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 text-[11px] transition-colors ${
        active
          ? "border-[var(--color-accent)] text-[var(--color-text)]"
          : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[label]}`} />
      {config.symbol.replace("-MOCK", "")}
      {label !== "OPEN" && <span className="text-[var(--color-warning)]">{label}</span>}
    </Link>
  );
}

/// Persistent across every page. Routing to a detail view would otherwise hide
/// the whole point of running five markets: seeing one halted while the rest
/// keep trading.
export function MarketStatusStrip({ activeKey }: { activeKey?: string }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Markets</span>
      {MARKETS.map((m) => (
        <Pill key={m.key} config={m} active={m.key === activeKey} />
      ))}
    </div>
  );
}
