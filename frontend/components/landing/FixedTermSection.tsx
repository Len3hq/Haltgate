import Link from "next/link";
import { ScrollReveal } from "./ScrollReveal";

const CONTRAST = [
  {
    kind: "Variable",
    tone: "var(--color-accent-blue)",
    rate: "Moves with utilization",
    close: "Liquidated if the price falls far enough",
    ltv: "45% to 60%, set per asset",
  },
  {
    kind: "Fixed Term",
    tone: "var(--color-accent)",
    rate: "Quoted once, never changes",
    close: "Cannot be liquidated at any price",
    ltv: "30% to 45%, set per asset",
  },
];

export function FixedTermSection() {
  return (
    <section id="fixed-term" className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">Fixed Term</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
          No liquidation. Ever.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--color-text-muted)] sm:text-base">
          A second loan type where maturity replaces liquidation. Lock a rate and an end date, and between those two
          points nothing can close your position out, however far the stock falls.
        </p>
      </div>

      <ScrollReveal className="mt-12 grid gap-4 sm:grid-cols-2">
        {CONTRAST.map((c) => (
          <div
            key={c.kind}
            className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: c.tone }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.tone }} />
              {c.kind}
            </span>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-[var(--color-text-faint)]">Rate</dt>
                <dd className="mt-0.5 text-[var(--color-text)]">{c.rate}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-text-faint)]">How it can close</dt>
                <dd className="mt-0.5 text-[var(--color-text)]">{c.close}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-text-faint)]">Max LTV</dt>
                <dd className="mt-0.5 text-[var(--color-text)]">{c.ltv}</dd>
              </div>
            </dl>
          </div>
        ))}
      </ScrollReveal>

      <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-[var(--color-text-muted)]">
        The tradeoff is real and stated everywhere it applies: you borrow less against the same collateral, and missing
        the end date forfeits the whole position rather than part of it. Both loan types stay available side by side.
      </p>

      <div className="mt-8 text-center">
        <Link
          href="/app/fixed"
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] transition-opacity hover:opacity-90"
        >
          Open Fixed Term
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
