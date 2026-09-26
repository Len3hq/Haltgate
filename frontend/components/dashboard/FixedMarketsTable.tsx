"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import {
  useReadHaltControllerState,
  useReadIPausableOracleLatestPrice,
  useReadMarketFixedLoans,
  useReadMarketFixedMaxLtv,
  useReadMarketFixedRatePerYear,
} from "@/lib/generated";
import { MARKETS, USDG_DECIMALS, type MarketConfig } from "@/lib/contracts";
import { formatAmount, formatBps, formatCountdown, formatPrice } from "@/lib/format";
import { useNow } from "@/lib/use-now";

const STATE_LABEL = ["OPEN", "HALTING", "HALTED", "RESUMING", "SETTLING"] as const;

const STATE_STYLE: Record<string, string> = {
  OPEN: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  HALTING: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  HALTED: "bg-[var(--color-error-bg)] text-[var(--color-error)]",
  RESUMING: "bg-[var(--color-bg-elevated)] text-[var(--color-accent-blue)]",
  SETTLING: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
};

const COLS = "grid-cols-[1.4fr_0.9fr_0.8fr_0.7fr_0.8fr_0.8fr]";
/// One extra column once a wallet is connected, so the list answers "where do I
/// have a loan?" without opening all five markets to find out.
const COLS_WITH_LOAN = "grid-cols-[1.4fr_0.9fr_0.8fr_0.7fr_0.8fr_0.8fr_1fr]";

function FixedRow({ config, cols, showLoan }: { config: MarketConfig; cols: string; showLoan: boolean }) {
  const poll = { refetchInterval: 15_000 };
  const { address } = useAccount();
  const now = useNow(30_000);

  const { data: state } = useReadHaltControllerState({ address: config.haltController, query: poll });
  const { data: priceData } = useReadIPausableOracleLatestPrice({ address: config.oracle, query: poll });
  const { data: fixedLtv } = useReadMarketFixedMaxLtv({ address: config.market });
  const { data: fixedRate } = useReadMarketFixedRatePerYear({ address: config.market });
  const { data: loan } = useReadMarketFixedLoans({
    address: config.market,
    args: address ? [address] : undefined,
    query: { enabled: !!address, ...poll },
  });

  const label = state === undefined ? "OPEN" : (STATE_LABEL[state] ?? "OPEN");
  const hasLoan = loan !== undefined && loan[1] > 0n;
  const matured = hasLoan && Number(loan[3]) <= now;

  return (
    <Link
      href={`/app/fixed/${config.key}`}
      className={`grid w-full ${cols} items-center gap-2 rounded-[var(--radius-card)] px-3 py-3 text-left text-xs transition-colors hover:bg-[var(--color-bg-elevated)]`}
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

      {showLoan &&
        (hasLoan ? (
          <span className="min-w-0">
            <span className="block truncate font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
              {formatAmount(loan[2], USDG_DECIMALS)} <span className="text-[10px] font-normal">USDG</span>
            </span>
            <span className={`block truncate text-[10px] ${matured ? "text-[var(--color-error)]" : "text-[var(--color-text-faint)]"}`}>
              {matured ? "Past due" : formatCountdown(loan[3], now)}
            </span>
          </span>
        ) : (
          <span className="text-[var(--color-text-faint)]">—</span>
        ))}
    </Link>
  );
}

/// The fixed-term product's own market list. It carries the column the shared
/// markets table has nowhere to put: max LTV differs per asset here (30% to
/// 45%), because nothing can liquidate these loans and the opening cushion is
/// the only protection for the whole term.
export function FixedMarketsTable() {
  const { isConnected } = useAccount();
  const cols = isConnected ? COLS_WITH_LOAN : COLS;

  return (
    <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Fixed Term Markets</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">Max LTV is set per asset, by how far each one moves</p>
      </div>

      {/* Seven columns do not fit a phone, so the table scrolls sideways rather
          than crushing every column to an unreadable width. */}
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className={`grid ${cols} gap-2 px-3 pb-1 text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]`}>
            <span>Asset</span>
            <span>Status</span>
            <span>Price</span>
            <span>Rate</span>
            <span>Max LTV</span>
            <span>Term</span>
            {isConnected && <span>Your Loan</span>}
          </div>

          <div className="space-y-1">
            {MARKETS.map((m) => (
              <FixedRow key={m.key} config={m} cols={cols} showLoan={isConnected} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
