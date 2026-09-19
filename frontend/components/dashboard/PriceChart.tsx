"use client";

import { useEffect, useRef } from "react";
import { useReadIPausableOracleLatestPrice } from "@/lib/generated";
import type { MarketConfig } from "@/lib/contracts";
import { formatPrice } from "@/lib/format";
import { useNow } from "@/lib/use-now";

/// Real market price for the underlying equity, via TradingView's free embed
/// (the same widget Kamino uses). A keeper feeds the oracle live quotes, so
/// the two normally agree. When they diverge it is because the oracle is
/// halted and deliberately frozen -- which is the whole thesis, so the strip
/// below calls that out rather than hiding it.
function freshness(updatedAt: bigint | undefined, now: number): string {
  if (updatedAt === undefined) return "";
  const age = now - Number(updatedAt);
  if (age < 90) return "updated just now";
  if (age < 3600) return `updated ${Math.round(age / 60)}m ago`;
  return `updated ${Math.round(age / 3600)}h ago`;
}

export function PriceChart({ config }: { config: MarketConfig }) {
  const container = useRef<HTMLDivElement>(null);
  const now = useNow(30_000);
  const { data: priceData } = useReadIPausableOracleLatestPrice({
    address: config.oracle,
    query: { refetchInterval: 15_000 },
  });

  const halted = priceData?.[2] === true;

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    el.innerHTML = ""; // re-runs on symbol change and under dev strict-mode double-mount

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [[config.name, `${config.tradingViewSymbol}|3M`]],
      chartOnly: false,
      width: "100%",
      height: 280,
      locale: "en",
      colorTheme: "dark",
      isTransparent: true,
      autosize: false,
      showVolume: false,
      showMA: false,
      fontColor: "#b0b0b0",
      gridLineColor: "rgba(56, 56, 56, 0.5)",
      backgroundColor: "rgba(0, 0, 0, 0)",
      lineWidth: 2,
      dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D"],
    });
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [config.name, config.tradingViewSymbol]);

  return (
    <details className="group rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)]" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">{config.name} Market Price</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            Real {config.tradingViewSymbol.split(":")[1]} price — reference only, not the protocol&apos;s feed
          </p>
        </div>
        <svg
          className="h-4 w-4 shrink-0 text-[var(--color-text-faint)] transition-transform group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="border-t border-[var(--color-border-subtle)] p-4 pt-3">
        <div ref={container} className="tradingview-widget-container min-h-[280px]" />

        <div
          className={`mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-[var(--radius-card)] px-3 py-2.5 text-xs ${
            halted ? "bg-[var(--color-error-bg)]" : "bg-[var(--color-bg-elevated)]"
          }`}
        >
          <span className="text-[var(--color-text-muted)]">Price this protocol lends against</span>
          <span className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
            ${formatPrice(priceData?.[0])}
            <span
              className={`ml-1.5 text-[10px] font-normal ${
                halted ? "text-[var(--color-error)]" : "text-[var(--color-text-faint)]"
              }`}
            >
              {halted ? "frozen by halt" : freshness(priceData?.[1], now)}
            </span>
          </span>
        </div>

        {halted && (
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            The feed is paused, so this figure is held at its last trustworthy value while the chart above keeps moving.
            Nothing can be liquidated or borrowed against a price nobody can currently verify.
          </p>
        )}
      </div>
    </details>
  );
}
