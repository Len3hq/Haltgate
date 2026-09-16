"use client";

import { useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import {
  useReadIPausableOracleLatestPrice,
  useReadMarketTotalCollateral,
  useReadMarketTotalBorrows,
  useReadMarketMaxLtv,
  useReadMarketLiquidationThreshold,
  useReadMarketReserveFactor,
  useReadInterestRateModelGetBorrowRatePerSecond,
  useReadInterestRateModelGetSupplyRatePerSecond,
} from "@/lib/generated";
import { CONTRACTS, USDG_DECIMALS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { formatAmount, formatApr, formatBps, formatPrice } from "@/lib/format";

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
  const { data: totalBorrows } = useReadMarketTotalBorrows({
    address: CONTRACTS.market,
    query: { refetchInterval: 10_000 },
  });
  const { data: maxLtv } = useReadMarketMaxLtv({ address: CONTRACTS.market });
  const { data: liquidationThreshold } = useReadMarketLiquidationThreshold({ address: CONTRACTS.market });
  const { data: reserveFactor } = useReadMarketReserveFactor({ address: CONTRACTS.market });

  // Money-market utilization (cash vs. borrows) -- what the interest rate
  // curve actually responds to. Distinct from the loan-to-value style
  // "debt vs. collateral value" figure computed below.
  const { data: vaultCash } = useReadContract({
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [CONTRACTS.lenderVault],
    query: { refetchInterval: 10_000 },
  });

  const { data: borrowRate } = useReadInterestRateModelGetBorrowRatePerSecond({
    address: CONTRACTS.interestRateModel,
    args: vaultCash !== undefined && totalBorrows !== undefined ? [vaultCash, totalBorrows] : undefined,
    query: { enabled: vaultCash !== undefined && totalBorrows !== undefined, refetchInterval: 10_000 },
  });
  const { data: supplyRate } = useReadInterestRateModelGetSupplyRatePerSecond({
    address: CONTRACTS.interestRateModel,
    args:
      vaultCash !== undefined && totalBorrows !== undefined && reserveFactor !== undefined
        ? [vaultCash, totalBorrows, reserveFactor]
        : undefined,
    query: { enabled: vaultCash !== undefined && totalBorrows !== undefined && reserveFactor !== undefined, refetchInterval: 10_000 },
  });

  const price = priceData?.[0];

  let collateralUtilization: bigint | undefined;
  if (price !== undefined && totalCollateral !== undefined && totalBorrows !== undefined) {
    const collateralValueWad = (toWad(totalCollateral, WNVDAX_DECIMALS) * price) / 10n ** 18n;
    const debtWad = toWad(totalBorrows, USDG_DECIMALS);
    collateralUtilization = collateralValueWad === 0n ? 0n : (debtWad * 10n ** 18n) / collateralValueWad;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="wNVDAx Price" value={`$${formatPrice(price)}`} sublabel="USDG" />
      <StatCard label="Total Supplied" value={formatAmount(totalCollateral, WNVDAX_DECIMALS)} sublabel="wNVDAx collateral" />
      <StatCard label="Total Borrowed" value={formatAmount(totalBorrows, USDG_DECIMALS)} sublabel="USDG, interest-inclusive" />
      <StatCard label="Debt / Collateral" value={formatBps(collateralUtilization)} sublabel={`Max LTV ${formatBps(maxLtv)}`} />
      <StatCard label="Supply APR" value={formatApr(supplyRate)} sublabel="Earned by LenderVault deposits" />
      <StatCard label="Borrow APR" value={formatApr(borrowRate)} sublabel="Paid by borrowers" />
      <StatCard label="Liq. Threshold" value={formatBps(liquidationThreshold)} sublabel="Position closes above this" />
      <StatCard label="Reserve Factor" value={formatBps(reserveFactor)} sublabel="Protocol's cut of interest" />
    </div>
  );
}
