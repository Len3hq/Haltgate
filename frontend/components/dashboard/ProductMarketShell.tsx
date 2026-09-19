"use client";

import Link from "next/link";
import { useReadHaltControllerState, useReadIPausableOracleLatestPrice } from "@/lib/generated";
import { MARKETS, marketByKey, marketContracts } from "@/lib/contracts";
import { MarketProvider } from "@/lib/market-context";
import { formatPrice } from "@/lib/format";
import { AppShell } from "@/components/dashboard/AppShell";
import { NetworkGuard } from "@/components/dashboard/NetworkGuard";
import { HaltStatusBanner } from "@/components/dashboard/HaltStatusBanner";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { TestnetTools } from "@/components/dashboard/TestnetTools";

const STATE_LABEL = ["OPEN", "HALTING", "HALTED", "RESUMING", "SETTLING"] as const;

const STATE_STYLE: Record<string, string> = {
  OPEN: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  HALTING: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  HALTED: "bg-[var(--color-error-bg)] text-[var(--color-error)]",
  RESUMING: "bg-[var(--color-bg-elevated)] text-[var(--color-accent-blue)]",
  SETTLING: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
};

type Props = {
  marketKey: string;
  /// Route prefix the market switcher stays inside, e.g. "/app/fixed".
  basePath: string;
  productLabel: string;
  /// The product's own action panel.
  panel: React.ReactNode;
  /// Product-specific explainer rendered under the chart.
  children?: React.ReactNode;
};

function Body({ marketKey, basePath, productLabel, panel, children }: Props) {
  const config = marketByKey(marketKey);
  const C = marketContracts(config);

  const { data: state } = useReadHaltControllerState({ address: C.haltController, query: { refetchInterval: 6_000 } });
  const { data: priceData } = useReadIPausableOracleLatestPrice({ address: C.oracle, query: { refetchInterval: 10_000 } });

  const label = state === undefined ? "OPEN" : (STATE_LABEL[state] ?? "OPEN");

  return (
    <>
      <nav className="dash-fade-in text-xs text-[var(--color-text-faint)]">
        <Link href={basePath} className="hover:text-[var(--color-text)]">
          {productLabel}
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-[var(--color-text-muted)]">
          {config.name} ({config.symbol})
        </span>
      </nav>

      <div className="dash-fade-in dash-fade-in-1 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={basePath}
            aria-label={`Back to ${productLabel}`}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            ←
          </Link>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{config.name}</h1>
          <span className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold ${STATE_STYLE[label]}`}>
            {label}
          </span>
        </div>

        <span className="text-xs text-[var(--color-text-muted)]">
          Price{" "}
          <span className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
            ${formatPrice(priceData?.[0])}
          </span>
        </span>
      </div>

      {/* Switching assets keeps you inside the product rather than dropping
          you back into the variable-rate market page. */}
      <div className="dash-fade-in dash-fade-in-1 mt-4 flex gap-1 overflow-x-auto rounded-[var(--radius-pill)] bg-[var(--color-bg-card)] p-1">
        {MARKETS.map((m) => (
          <Link
            key={m.key}
            href={`${basePath}/${m.key}`}
            className={`flex-1 whitespace-nowrap rounded-[var(--radius-pill)] px-3 py-2 text-center text-xs font-medium transition-colors ${
              m.key === marketKey
                ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {m.symbol}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="dash-fade-in dash-fade-in-2 space-y-4 lg:col-span-2">
          <HaltStatusBanner />
          <PriceChart config={config} />
          {children}
        </div>

        <div className="dash-fade-in dash-fade-in-2">
          <div className="space-y-4 lg:sticky lg:top-24">
            {panel}
            <TestnetTools />
          </div>
        </div>
      </div>
    </>
  );
}

/// Shared chrome for a single market inside a product route. Same provider and
/// halt gating as the variable-rate market page, but scoped to one product.
export function ProductMarketShell(props: Props) {
  return (
    <AppShell>
      <NetworkGuard>
        <MarketProvider marketKey={props.marketKey}>
          <Body {...props} />
        </MarketProvider>
      </NetworkGuard>
    </AppShell>
  );
}
