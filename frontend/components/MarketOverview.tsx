"use client";

import {
  useReadIPausableOracleLatestPrice,
  useReadMarketTotalCollateral,
  useReadMarketTotalDebt,
  useReadMarketMaxLtv,
  useReadMarketLiquidationThreshold,
} from "@/lib/generated";
import { CONTRACTS, USDG_DECIMALS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { formatAmount, formatBps, formatPrice } from "@/lib/format";

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{sublabel}</p>}
    </div>
  );
}

export function MarketOverview() {
  const { data: priceData } = useReadIPausableOracleLatestPrice({
    address: CONTRACTS.oracle,
    query: { refetchInterval: 10_000 },
  });
  const { data: totalCollateral } = useReadMarketTotalCollateral({
    address: CONTRACTS.market,
    query: { refetchInterval: 10_000 },
  });
  const { data: totalDebt } = useReadMarketTotalDebt({
    address: CONTRACTS.market,
    query: { refetchInterval: 10_000 },
  });
  const { data: maxLtv } = useReadMarketMaxLtv({ address: CONTRACTS.market });
  const { data: liquidationThreshold } = useReadMarketLiquidationThreshold({ address: CONTRACTS.market });

  const price = priceData?.[0];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="wNVDAx Price" value={`$${formatPrice(price)}`} sublabel="USDG" />
      <StatCard label="Total Supplied" value={formatAmount(totalCollateral, WNVDAX_DECIMALS)} sublabel="wNVDAx" />
      <StatCard label="Total Borrowed" value={formatAmount(totalDebt, USDG_DECIMALS)} sublabel="USDG" />
      <StatCard label="Max LTV" value={formatBps(maxLtv)} sublabel={`Liq. threshold ${formatBps(liquidationThreshold)}`} />
    </div>
  );
}
