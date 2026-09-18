"use client";

import {
  useReadIPausableOracleLatestPrice,
  useReadMarketTotalCollateral,
  useReadMarketTotalBorrows,
  useReadMarketMaxLtv,
  useReadMarketLiquidationThreshold,
  useReadMarketReserveFactor,
} from "@/lib/generated";
import { CONTRACTS, USDG_DECIMALS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { formatAmount, formatBps, formatPrice } from "@/lib/format";

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div
      data-stat-card
      className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 transition-colors hover:border-[var(--color-border-subtle)]"
    >
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{sublabel}</p>}
    </div>
  );
}

function toWad(amount: bigint, decimals: number): bigint {
  return decimals === 18 ? amount : amount * 10n ** BigInt(18 - decimals);
}

/// The four numbers that describe "what is this market, right now" at a
/// glance. Everything rate-related (Supply/Borrow APR) moved to
/// RateCurveChart, where utilization actually explains *why* the rate is
/// what it is instead of sitting beside it as an unrelated card -- and the
/// three fixed risk parameters (LTV, liquidation threshold, reserve factor)
/// moved to a single compact strip, since they're configuration to glance
/// at, not headline figures worth the same visual weight as live totals.
export function MarketOverview() {
  const { data: priceData } = useReadIPausableOracleLatestPrice({
    address: CONTRACTS.oracle,
    query: { refetchInterval: 10_000 },
  });
  const { data: totalCollateral } = useReadMarketTotalCollateral({
    address: CONTRACTS.market,
    query: { refetchInterval: 10_000 },
  });
  const { data: totalBorrows } = useReadMarketTotalBorrows({
    address: CONTRACTS.market,
    query: { refetchInterval: 10_000 },
  });
  const { data: maxLtv } = useReadMarketMaxLtv({ address: CONTRACTS.market });
  const { data: liquidationThreshold } = useReadMarketLiquidationThreshold({ address: CONTRACTS.market });
  const { data: reserveFactor } = useReadMarketReserveFactor({ address: CONTRACTS.market });

  const price = priceData?.[0];

  // Debt vs. collateral VALUE (LTV-style) -- distinct from pool utilization
  // (cash vs. borrows), which drives the rate curve and lives on that chart
  // instead. Two different "how full is this" numbers were previously both
  // labeled loosely as "utilization" on this same card, which is exactly
  // the kind of ambiguity this redesign is meant to remove.
  let debtToCollateral: bigint | undefined;
  if (price !== undefined && totalCollateral !== undefined && totalBorrows !== undefined) {
    const collateralValueWad = (toWad(totalCollateral, WNVDAX_DECIMALS) * price) / 10n ** 18n;
    const debtWad = toWad(totalBorrows, USDG_DECIMALS);
    debtToCollateral = collateralValueWad === 0n ? 0n : (debtWad * 10n ** 18n) / collateralValueWad;
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="wNVDAx Price" value={`$${formatPrice(price)}`} sublabel="USDG" />
        <StatCard label="Total Supplied" value={formatAmount(totalCollateral, WNVDAX_DECIMALS)} sublabel="wNVDAx collateral" />
        <StatCard label="Total Borrowed" value={formatAmount(totalBorrows, USDG_DECIMALS)} sublabel="USDG, interest-inclusive" />
        <StatCard label="Debt / Collateral" value={formatBps(debtToCollateral)} sublabel={`Max LTV ${formatBps(maxLtv)}`} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
        <span>
          Max LTV <span className="font-medium text-[var(--color-text)]">{formatBps(maxLtv)}</span>
        </span>
        <span>
          Liq. threshold <span className="font-medium text-[var(--color-text)]">{formatBps(liquidationThreshold)}</span>
        </span>
        <span>
          Reserve factor <span className="font-medium text-[var(--color-text)]">{formatBps(reserveFactor)}</span>
        </span>
      </div>
    </div>
  );
}
