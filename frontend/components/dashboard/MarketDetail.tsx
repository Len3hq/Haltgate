"use client";

import { useState } from "react";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import {
  useReadHaltControllerState,
  useReadIPausableOracleLatestPrice,
  useReadMarketTotalBorrows,
  useReadMarketTotalCollateral,
  useReadMarketReserveFactor,
  useReadInterestRateModelGetBorrowRatePerSecond,
  useReadInterestRateModelGetSupplyRatePerSecond,
} from "@/lib/generated";
import { marketByKey, marketContracts, USDG_DECIMALS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { MarketProvider } from "@/lib/market-context";
import { formatAmount, formatApr, formatPrice } from "@/lib/format";
import { AppShell } from "@/components/dashboard/AppShell";
import { NetworkGuard } from "@/components/dashboard/NetworkGuard";
import { MarketStatusStrip } from "@/components/dashboard/MarketStatusStrip";
import { HaltStatusBanner } from "@/components/dashboard/HaltStatusBanner";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { RateCurveChart } from "@/components/dashboard/RateCurveChart";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { PositionPanel } from "@/components/dashboard/PositionPanel";
import { HaltSettlementPanel } from "@/components/dashboard/HaltSettlementPanel";
import { AssetDetails } from "@/components/dashboard/AssetDetails";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { InfoTip } from "@/components/dashboard/InfoTip";
import { TestnetTools } from "@/components/dashboard/TestnetTools";
import { GetStarted } from "@/components/dashboard/GetStarted";

const STATE_LABEL = ["OPEN", "HALTING", "HALTED", "RESUMING", "SETTLING"] as const;

const STATE_STYLE: Record<string, string> = {
  OPEN: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  HALTING: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  HALTED: "bg-[var(--color-error-bg)] text-[var(--color-error)]",
  RESUMING: "bg-[var(--color-bg-elevated)] text-[var(--color-accent-blue)]",
  SETTLING: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
};

function Stat({ label, value, unit, tone, tip }: { label: string; value: string; unit?: string; tone?: string; tip: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">
        {label}
        <InfoTip text={tip} align="left" />
      </p>
      <p className={`mt-1 font-[family-name:var(--font-display)] text-lg font-semibold ${tone ?? "text-[var(--color-text)]"}`}>
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-[var(--color-text-muted)]">{unit}</span>}
      </p>
    </div>
  );
}

function DetailBody({ marketKey }: { marketKey: string }) {
  const [tab, setTab] = useState<"overview" | "position">("overview");
  const config = marketByKey(marketKey);
  const C = marketContracts(config);
  const poll = { refetchInterval: 10_000 };

  const { data: state } = useReadHaltControllerState({ address: C.haltController, query: { refetchInterval: 6_000 } });
  const { data: priceData } = useReadIPausableOracleLatestPrice({ address: C.oracle, query: poll });
  const { data: totalCollateral } = useReadMarketTotalCollateral({ address: C.market, query: poll });
  const { data: totalBorrows } = useReadMarketTotalBorrows({ address: C.market, query: poll });
  const { data: reserveFactor } = useReadMarketReserveFactor({ address: C.market });
  const { data: cash } = useReadContract({
    address: C.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [C.lenderVault],
    query: poll,
  });

  const ready = cash !== undefined && totalBorrows !== undefined;
  const { data: borrowRate } = useReadInterestRateModelGetBorrowRatePerSecond({
    address: C.interestRateModel,
    args: ready ? [cash, totalBorrows] : undefined,
    query: { enabled: ready, ...poll },
  });
  const { data: supplyRate } = useReadInterestRateModelGetSupplyRatePerSecond({
    address: C.interestRateModel,
    args: ready && reserveFactor !== undefined ? [cash, totalBorrows, reserveFactor] : undefined,
    query: { enabled: ready && reserveFactor !== undefined, ...poll },
  });

  const label = state === undefined ? "OPEN" : (STATE_LABEL[state] ?? "OPEN");
  const halted = label !== "OPEN";
  const util =
    ready && cash + totalBorrows > 0n ? `${(Number((totalBorrows * 10000n) / (cash + totalBorrows)) / 100).toFixed(1)}%` : "0%";

  return (
    <>
      <div className="dash-fade-in">
        <MarketStatusStrip activeKey={marketKey} />
      </div>

      <nav className="dash-fade-in mt-4 text-xs text-[var(--color-text-faint)]">
        <Link href="/app" className="hover:text-[var(--color-text)]">
          Markets
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-[var(--color-text-muted)]">
          {config.name} ({config.symbol})
        </span>
      </nav>

      <div className="dash-fade-in dash-fade-in-1 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            aria-label="Back to markets"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            ←
          </Link>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{config.name}</h1>
          <span className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold ${STATE_STYLE[label]}`}>{label}</span>
        </div>

        <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
          <span>
            Price{" "}
            <span className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
              ${formatPrice(priceData?.[0])}
            </span>
          </span>
          <span className="hidden sm:inline">Oracle: mock pauseOracle feed</span>
        </div>
      </div>

      <div className="dash-fade-in dash-fade-in-1 mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat
          label="Total Supplied"
          value={formatAmount(totalCollateral, WNVDAX_DECIMALS)}
          unit={config.symbol.replace("-MOCK", "")}
          tip="All collateral deposited into this market by every borrower. It backs their loans and cannot be withdrawn below what their debt requires."
        />
        <Stat
          label="Liquidity Available"
          value={formatAmount(cash, USDG_DECIMALS)}
          unit="USDG"
          tip="USDG sitting in the vault right now, free to be borrowed or withdrawn. The rest is already out on loan. This is usually what limits a borrow or a leverage loop before the LTV ceiling does."
        />
        <Stat
          label="Total Borrowed"
          value={formatAmount(totalBorrows, USDG_DECIMALS)}
          unit={`USDG · ${util}`}
          tip="USDG currently lent out, interest included. The percentage is utilization: borrowed divided by the pool total. Higher utilization pushes both rates up."
        />
        <Stat
          label="Supply APR"
          value={halted ? "—" : formatApr(supplyRate)}
          tone="text-[var(--color-success)]"
          tip="What lenders earn on deposited USDG, before compounding. It rises with utilization and is shown as a dash while halted, because interest stops accruing entirely."
        />
        <Stat
          label="Borrow APR"
          value={halted ? "—" : formatApr(borrowRate)}
          tone="text-[var(--color-accent-blue)]"
          tip="What borrowers pay on outstanding debt, before compounding. It rises steeply once utilization passes the kink, to protect lenders' ability to withdraw."
        />
      </div>

      <div className="dash-fade-in dash-fade-in-2 mt-5 flex gap-1 border-b border-[var(--color-border-subtle)]">
        {(["overview", "position"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm capitalize transition-colors ${
              tab === t
                ? "border-[var(--color-accent)] font-medium text-[var(--color-text)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t === "position" ? "My Position" : "Overview"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="dash-fade-in dash-fade-in-2 space-y-4 lg:col-span-2">
          {tab === "overview" ? (
            <>
              <HaltStatusBanner />
              <PriceChart config={config} />
              <HaltSettlementPanel />
              <RateCurveChart />
              <AssetDetails config={config} />
            </>
          ) : (
            <>
              <PositionPanel />
              <ActivityFeed />
            </>
          )}
        </div>

        <div className="dash-fade-in dash-fade-in-2">
          <div className="space-y-4 lg:sticky lg:top-24">
            <GetStarted />
            <DashboardTabs />
            <TestnetTools />
          </div>
        </div>
      </div>
    </>
  );
}

export function MarketDetail({ marketKey }: { marketKey: string }) {
  return (
    <AppShell>
      <NetworkGuard>
        <MarketProvider marketKey={marketKey}>
          <DetailBody marketKey={marketKey} />
        </MarketProvider>
      </NetworkGuard>
    </AppShell>
  );
}
