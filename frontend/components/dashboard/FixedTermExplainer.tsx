"use client";

import {
  useReadMarketFixedMaxLtv,
  useReadMarketFixedRatePerYear,
  useReadMarketMaxLtv,
  useReadMarketSettlementBounty,
} from "@/lib/generated";
import { useMarketContracts } from "@/lib/market-context";
import { formatBps } from "@/lib/format";

function Row({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-[var(--color-border-subtle)] py-2.5 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--color-text)]">{label}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-muted)]">{note}</p>
      </div>
      <span className="shrink-0 font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-text)]">
        {value}
      </span>
    </div>
  );
}

/// Reads this market's own fixed parameters rather than restating the numbers
/// from the product page, so the page stays right if governance retunes them.
export function FixedTermExplainer() {
  const C = useMarketContracts();
  const { data: fixedLtv } = useReadMarketFixedMaxLtv({ address: C.market });
  const { data: maxLtv } = useReadMarketMaxLtv({ address: C.market });
  const { data: rate } = useReadMarketFixedRatePerYear({ address: C.market });
  const { data: bounty } = useReadMarketSettlementBounty({ address: C.market });

  return (
    <details
      open
      className="group rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">How this loan resolves</span>
        <span className="text-[var(--color-text-faint)] transition-transform group-open:rotate-180">⌄</span>
      </summary>

      <div className="px-4 pb-4">
        <Row
          label="Rate for this market"
          value={formatBps(rate)}
          note="Simple interest, quoted once at origination and fixed for the whole term."
        />
        <Row
          label="Max LTV here"
          value={formatBps(fixedLtv)}
          note={`Lower than the variable market's ${formatBps(maxLtv)}, because nothing can close this position out early and losses land on a shared pool.`}
        />
        <Row
          label="If you repay on time"
          value="Collateral back"
          note="Repay the exact quoted amount and the collateral unlocks in full. Repaying works during a halt too."
        />
        <Row
          label="If you miss the end date"
          value="Collateral claimed"
          note="Anyone can close out a past-due loan and the whole collateral is claimed, with no partial return and no price read. You can still repay right up until they do."
        />
        {bounty !== undefined && bounty > 0n && (
          <Row
            label="Paid to whoever settles"
            value={formatBps(bounty)}
            note="Closing out a defaulted loan costs only gas, so a small share of the collateral pays for it. Without that nobody would bother, and the pool would keep carrying a dead loan at full value."
          />
        )}
      </div>
    </details>
  );
}
