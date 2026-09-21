"use client";

import Link from "next/link";
import { MAINNET_ASSETS, type MainnetAsset } from "@/lib/mainnet";
import { useMainnetAsset } from "@/lib/use-mainnet-asset";

const COLS = "grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr_0.8fr]";

function n(v: number | undefined, dp = 2) {
  if (v === undefined) return "…";
  return v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function Row({ asset }: { asset: MainnetAsset }) {
  const d = useMainnetAsset(asset);

  return (
    <Link
      href={`/app/mainnet/${asset.key}`}
      className={`grid w-full ${COLS} items-center gap-2 rounded-[var(--radius-card)] px-3 py-3 text-left text-xs transition-colors hover:bg-[var(--color-bg-elevated)]`}
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-[var(--color-text)]">{asset.name}</span>
        <span className="block truncate text-[10px] text-[var(--color-text-faint)]">{d.symbol ?? asset.ticker}</span>
      </span>

      <span>
        <span
          className={`inline-block rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold ${
            d.thin === undefined
              ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-faint)]"
              : d.thin
                ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                : "bg-[var(--color-success-bg)] text-[var(--color-success)]"
          }`}
        >
          {d.thin === undefined ? "LOADING" : d.thin ? "SHALLOW" : "DEEP"}
        </span>
      </span>

      <span className="font-[family-name:var(--font-display)] text-[var(--color-text)]">
        {d.twap ?? d.spot ? `$${n(d.twap ?? d.spot ?? 0)}` : "…"}
        {!asset.twapAvailable && d.spot !== null && (
          <span className="ml-1 text-[9px] font-normal text-[var(--color-text-faint)]">spot</span>
        )}
      </span>

      <span className="text-[var(--color-text-muted)]">{d.usdgInPool !== undefined ? `${n(d.usdgInPool, 0)}` : "…"}</span>

      <span className="font-[family-name:var(--font-display)] text-[var(--color-text-muted)]">
        {d.multiplier !== undefined ? d.multiplier.toFixed(6) : "…"}
      </span>
    </Link>
  );
}

/// Same shape as the testnet markets table, reading chain 196 instead. Rows
/// link through to detail pages exactly as they do on testnet: the difference
/// is what you can do once you arrive, not how you get there.
export function MainnetMarketsTable() {
  return (
    <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Mainnet Markets</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">Live prices from X Layer</p>
      </div>

      <div
        className={`mt-3 grid ${COLS} gap-2 px-3 pb-1 text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]`}
      >
        <span>Asset</span>
        <span>Depth</span>
        <span>Price</span>
        <span>USDG depth</span>
        <span>Adjustment</span>
      </div>

      <div className="space-y-1">
        {MAINNET_ASSETS.map((a) => (
          <Row key={a.key} asset={a} />
        ))}
      </div>
    </div>
  );
}
