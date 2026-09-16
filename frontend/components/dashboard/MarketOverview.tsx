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

  let utilization: bigint | undefined;
  if (price !== undefined && totalCollateral !== undefined && totalDebt !== undefined) {
    const collateralValueWad = (toWad(totalCollateral, WNVDAX_DECIMALS) * price) / 10n ** 18n;
    const debtWad = toWad(totalDebt, USDG_DECIMALS);
    utilization = collateralValueWad === 0n ? 0n : (debtWad * 10n ** 18n) / collateralValueWad;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <StatCard label="wNVDAx Price" value={`$${formatPrice(price)}`} sublabel="USDG" />
      <StatCard label="Total Supplied" value={formatAmount(totalCollateral, WNVDAX_DECIMALS)} sublabel="wNVDAx" />
      <StatCard label="Total Borrowed" value={formatAmount(totalDebt, USDG_DECIMALS)} sublabel="USDG" />
      <StatCard label="Utilization" value={formatBps(utilization)} sublabel="Debt / collateral value" />
      <StatCard label="Max LTV" value={formatBps(maxLtv)} sublabel={`Liq. threshold ${formatBps(liquidationThreshold)}`} />
    </div>
  );
}
