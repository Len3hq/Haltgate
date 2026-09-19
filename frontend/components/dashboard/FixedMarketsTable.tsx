"use client";

import Link from "next/link";
import {
  useReadHaltControllerState,
  useReadIPausableOracleLatestPrice,
  useReadMarketFixedMaxLtv,
  useReadMarketFixedRatePerYear,
} from "@/lib/generated";
import { MARKETS, type MarketConfig } from "@/lib/contracts";
import { formatBps, formatPrice } from "@/lib/format";

const STATE_LABEL = ["OPEN", "HALTING", "HALTED", "RESUMING", "SETTLING"] as const;

const STATE_STYLE: Record<string, string> = {
  OPEN: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  HALTING: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  HALTED: "bg-[var(--color-error-bg)] text-[var(--color-error)]",
  RESUMING: "bg-[var(--color-bg-elevated)] text-[var(--color-accent-blue)]",
  SETTLING: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
};

const COLS = "grid-cols-[1.4fr_0.9fr_0.8fr_0.7fr_0.8fr_0.8fr]";

function FixedRow({ config }: { config: MarketConfig }) {
  const poll = { refetchInterval: 15_000 };

  const { data: state } = useReadHaltControllerState({ address: config.haltController, query: poll });
  const { data: priceData } = useReadIPausableOracleLatestPrice({ address: config.oracle, query: poll });
  const { data: fixedLtv } = useReadMarketFixedMaxLtv({ address: config.market });
  const { data: fixedRate } = useReadMarketFixedRatePerYear({ address: config.market });

  const label = state === undefined ? "OPEN" : (STATE_LABEL[state] ?? "OPEN");

  return (
    <Link
      href={`/app/fixed/${config.key}`}
      className={`grid w-full ${COLS} items-center gap-2 rounded-[var(--radius-card)] px-3 py-3 text-left text-xs transition-colors hover:bg-[var(--color-bg-elevated)]`}
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-[var(--color-text)]">{config.name}</span>
        <span className="block truncate text-[10px] text-[var(--color-text-faint)]">{config.symbol}</span>
      </span>

      <span>
        <span className={`inline-block rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold ${STATE_STYLE[label]}`}>
          {label}
        </span>
      </span>

      <span className="font-[family-name:var(--font-display)] text-[var(--color-text)]">
        ${formatPrice(priceData?.[0])}
      </span>

      {/* The fixed rate is locked at origination, so unlike the variable
          market's APR it stays meaningful even while the market is halted. */}
      <span className="font-[family-name:var(--font-display)] text-[var(--color-accent-blue)]">{formatBps(fixedRate)}</span>

      <span className="font-[family-name:var(--font-display)] text-[var(--color-text)]">{formatBps(fixedLtv)}</span>

      <span className="text-[var(--color-text-muted)]">1 to 30 days</span>
    </Link>
  );
}

/// The fixed-term product's own market list. It carries the column the shared
/// markets table has nowhere to put: max LTV differs per asset here (30% to
/// 45%), because nothing can liquidate these loans and the opening cushion is
/// the only protection for the whole term.
export function FixedMarketsTable() {
  return (
    <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Fixed Term Markets</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">Max LTV is set per asset, by how far each one moves</p>
      </div>

      <div className={`mt-3 grid ${COLS} gap-2 px-3 pb-1 text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]`}>
        <span>Asset</span>
        <span>Status</span>
        <span>Price</span>
        <span>Rate</span>
        <span>Max LTV</span>
        <span>Term</span>
      </div>

      <div className="space-y-1">
        {MARKETS.map((m) => (
          <FixedRow key={m.key} config={m} />
        ))}
      </div>
    </div>
  );
}
