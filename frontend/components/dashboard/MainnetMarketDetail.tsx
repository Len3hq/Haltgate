"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AppShell } from "@/components/dashboard/AppShell";
import { MainnetNotice } from "@/components/dashboard/MainnetNotice";
import { MAINNET_ASSETS, type MainnetAsset } from "@/lib/mainnet";
import { useMainnetAsset } from "@/lib/use-mainnet-asset";
import { xLayerMainnet } from "@/lib/chains";

type Tab = "borrow" | "fixed" | "multiply" | "earn";

const TABS: { key: Tab; label: string; blurb: string }[] = [
  { key: "borrow", label: "Borrow", blurb: "Supply the stock as collateral, borrow USDG against it." },
  { key: "fixed", label: "Fixed Term", blurb: "Lock a rate and an end date, with no liquidation for the whole term." },
  { key: "multiply", label: "Multiply", blurb: "Loop into amplified exposure in one transaction." },
  { key: "earn", label: "Earn", blurb: "Supply USDG and earn what borrowers pay." },
];

function n(v: number | undefined, dp = 2) {
  if (v === undefined) return "…";
  return v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/// The reference chart, same TradingView embed the testnet detail pages use.
/// Duplicated rather than shared because the testnet component reads its price
/// from an oracle contract, and there is no such contract here.
function Chart({ asset }: { asset: MainnetAsset }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    el.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [[asset.name, `${asset.tradingViewSymbol}|3M`]],
      chartOnly: false,
      width: "100%",
      height: 280,
      locale: "en",
      colorTheme: "dark",
      isTransparent: true,
      autosize: false,
      showVolume: false,
      showMA: false,
      almostEmpty: false,
    });
    el.appendChild(script);
    return () => {
      el.innerHTML = "";
    };
  }, [asset]);

  return <div ref={container} className="tradingview-widget-container min-h-[280px]" />;
}

export function MainnetMarketDetail({ asset }: { asset: MainnetAsset }) {
  const [tab, setTab] = useState<Tab>("borrow");
  const d = useMainnetAsset(asset);
  const active = TABS.find((t) => t.key === tab);

  return (
    <AppShell>
      <MainnetNotice />

      <nav className="dash-fade-in text-xs text-[var(--color-text-faint)]">
        <Link href="/app/mainnet" className="hover:text-[var(--color-text)]">
          Mainnet
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-[var(--color-text-muted)]">
          {asset.name} ({d.symbol ?? asset.ticker})
        </span>
      </nav>

      <div className="dash-fade-in dash-fade-in-1 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/app/mainnet"
            aria-label="Back to mainnet markets"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            ←
          </Link>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{asset.name}</h1>
          <span className="rounded-[var(--radius-pill)] bg-[var(--color-warning-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-warning)]">
            Not deployed
          </span>
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">
          Pool price{" "}
          <span className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
            {d.twap ?? d.spot ? `$${n(d.twap ?? d.spot ?? 0)}` : "…"}
          </span>
        </span>
      </div>

      {/* Same switcher pattern as the testnet product pages. */}
      <div className="dash-fade-in dash-fade-in-1 mt-4 flex gap-1 overflow-x-auto rounded-[var(--radius-pill)] bg-[var(--color-bg-card)] p-1">
        {MAINNET_ASSETS.map((m) => (
          <Link
            key={m.key}
            href={`/app/mainnet/${m.key}`}
            className={`flex-1 whitespace-nowrap rounded-[var(--radius-pill)] px-3 py-2 text-center text-xs font-medium transition-colors ${
              m.key === asset.key
                ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {m.ticker}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="dash-fade-in dash-fade-in-2 space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label={d.twap ? "Price, hourly average" : "Price, right now"}
              value={d.twap ?? d.spot ? `$${n(d.twap ?? d.spot ?? 0)}` : "…"}
            />
            <Stat label="USDG depth" value={d.usdgInPool !== undefined ? n(d.usdgInPool, 0) : "…"} />
            <Stat label="Stock in pool" value={n(d.stockInPool)} />
            <Stat label="Split / dividend adjustment" value={d.multiplier !== undefined ? d.multiplier.toFixed(6) : "…"} />
          </div>

          <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Reference price</p>
            <div className="mt-3">
              <Chart asset={asset} />
            </div>
          </div>

          {!asset.twapAvailable && (
            <p className="rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-4 py-3 text-xs leading-relaxed text-[var(--color-warning)]">
              This pool can only quote its price right now, not an hourly average. A lending market would want the
              average, because a single moment&apos;s price is much easier for someone to push around. The pool simply
              has not been configured to keep that history, which anyone can switch on.
            </p>
          )}
        </div>

        <div className="dash-fade-in dash-fade-in-2">
          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
              <div className="flex gap-1 rounded-[var(--radius-pill)] bg-[var(--color-bg-elevated)] p-1">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex-1 whitespace-nowrap rounded-[var(--radius-pill)] px-2 py-2 text-xs font-medium transition-colors ${
                      tab === t.key
                        ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">{active?.blurb}</p>

              <div className="mt-4 space-y-2 opacity-60">
                <div className="h-9 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)]" />
                <div className="h-9 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)]" />
              </div>

              <button
                disabled
                className="mt-3 w-full cursor-not-allowed rounded-[var(--radius-pill)] bg-[var(--color-bg-elevated)] py-2.5 text-sm font-semibold text-[var(--color-text-faint)]"
              >
                Not available on mainnet
              </button>
              <p className="mt-2 text-center text-[11px] text-[var(--color-text-faint)]">
                Works today on{" "}
                <Link href={`/app/${asset.key}`} className="text-[var(--color-accent)] hover:underline">
                  testnet
                </Link>
              </p>
            </div>

            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-[11px] text-[var(--color-text-muted)]">
              <p className="uppercase tracking-wide text-[var(--color-text-faint)]">Contracts</p>
              <p className="mt-2 break-all">
                <a
                  href={`${xLayerMainnet.blockExplorers.default.url}/address/${asset.wrapped}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] hover:underline"
                >
                  Wrapped token ↗
                </a>
                <br />
                <a
                  href={`${xLayerMainnet.blockExplorers.default.url}/address/${asset.pool}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] hover:underline"
                >
                  USDG pool ↗
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">{label}</p>
      <p
        className={`mt-1 font-[family-name:var(--font-display)] text-lg font-semibold ${
          bad ? "text-[var(--color-error)]" : "text-[var(--color-text)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
