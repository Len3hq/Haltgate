"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import {
  useReadHaltControllerState,
  useReadIPausableOracleLatestPrice,
  useReadMarketTotalBorrows,
  useReadMarketReserveFactor,
  useReadInterestRateModelGetBorrowRatePerSecond,
  useReadInterestRateModelGetSupplyRatePerSecond,
} from "@/lib/generated";
import { MARKETS, SHARED, type MarketConfig } from "@/lib/contracts";
import { formatApr, formatPrice } from "@/lib/format";

const STATE_LABEL = ["OPEN", "HALTING", "HALTED", "RESUMING", "SETTLING"] as const;

const STATE_STYLE: Record<string, string> = {
  OPEN: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  HALTING: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  HALTED: "bg-[var(--color-error-bg)] text-[var(--color-error)]",
  RESUMING: "bg-[var(--color-bg-elevated)] text-[var(--color-accent-blue)]",
  SETTLING: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
};

function utilizationPct(cash: bigint | undefined, borrows: bigint | undefined): string {
  if (cash === undefined || borrows === undefined) return "—";
  const total = cash + borrows;
  if (total === 0n) return "0%";
  return `${(Number((borrows * 10000n) / total) / 100).toFixed(1)}%`;
}

function MarketRow({ config }: { config: MarketConfig }) {
  const poll = { refetchInterval: 15_000 };

  const { data: state } = useReadHaltControllerState({ address: config.haltController, query: poll });
  const { data: priceData } = useReadIPausableOracleLatestPrice({ address: config.oracle, query: poll });
  const { data: totalBorrows } = useReadMarketTotalBorrows({ address: config.market, query: poll });
  const { data: reserveFactor } = useReadMarketReserveFactor({ address: config.market });
  const { data: cash } = useReadContract({
    address: SHARED.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [config.lenderVault],
    query: poll,
  });

  const rateArgsReady = cash !== undefined && totalBorrows !== undefined;
  const { data: borrowRate } = useReadInterestRateModelGetBorrowRatePerSecond({
    address: SHARED.interestRateModel,
    args: rateArgsReady ? [cash, totalBorrows] : undefined,
    query: { enabled: rateArgsReady, ...poll },
  });
  const { data: supplyRate } = useReadInterestRateModelGetSupplyRatePerSecond({
    address: SHARED.interestRateModel,
    args: rateArgsReady && reserveFactor !== undefined ? [cash, totalBorrows, reserveFactor] : undefined,
    query: { enabled: rateArgsReady && reserveFactor !== undefined, ...poll },
  });

  const label = state === undefined ? "OPEN" : (STATE_LABEL[state] ?? "OPEN");
  const halted = label !== "OPEN";

  return (
    <Link
      href={`/app/${config.key}`}
      className="grid w-full grid-cols-[1.4fr_0.9fr_0.8fr_0.8fr_0.8fr_0.7fr] items-center gap-2 rounded-[var(--radius-card)] px-3 py-3 text-left text-xs transition-colors hover:bg-[var(--color-bg-elevated)]"
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

      {/* Rates are meaningless while a market is halted — interest is frozen,
          so showing a live-looking APR would misrepresent what's happening. */}
      <span className="text-[var(--color-success)]">{halted ? "—" : formatApr(supplyRate)}</span>
      <span className="text-[var(--color-accent-blue)]">{halted ? "—" : formatApr(borrowRate)}</span>
      <span className="text-[var(--color-text-muted)]">{utilizationPct(cash, totalBorrows)}</span>
    </Link>
  );
}

/// Every market, side by side. Modelled on Kamino's isolated-market lending
/// table (asset / rates / utilization), with one column they don't need: halt
/// status. Seeing one stock HALTED while the rest keep trading is the clearest
/// demonstration that halts are per-asset rather than protocol-wide.
export function MarketsTable() {
  return (
    <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Markets</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Each stock is an isolated market — halting one leaves the others trading
        </p>
      </div>

      <div className="mt-3 grid grid-cols-[1.4fr_0.9fr_0.8fr_0.8fr_0.8fr_0.7fr] gap-2 px-3 pb-1 text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">
        <span>Asset</span>
        <span>Status</span>
        <span>Price</span>
        <span>Supply</span>
        <span>Borrow</span>
        <span>Util.</span>
      </div>

      <div className="space-y-1">
        {MARKETS.map((m) => (
          <MarketRow key={m.key} config={m} />
        ))}
      </div>
    </div>
  );
}
