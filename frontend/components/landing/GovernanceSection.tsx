import { ScrollReveal } from "./ScrollReveal";

const STATES = [
  { label: "OPEN", color: "var(--color-success)", desc: "Supply, borrow, repay, and liquidate all available." },
  { label: "HALTING", color: "var(--color-warning)", desc: "A corporate action is approaching. New supply/borrow paused." },
  { label: "HALTED", color: "var(--color-error)", desc: "Oracle frozen. Only repayment is available until it resolves." },
  { label: "RESUMING", color: "var(--color-accent-blue)", desc: "Fresh price is in. Liquidations wait one beat before reopening." },
];

export function GovernanceSection() {
  return (
    <section id="governance" className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">Governance</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
          The market&apos;s state machine, not a human&apos;s judgment call
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--color-text-muted)] sm:text-base">
          Every halt follows the same fixed sequence. Nobody can skip a step, and repayment is never blocked, no
          matter which state the market is in.
        </p>
      </div>

      <ScrollReveal className="mt-14 grid gap-3 sm:grid-cols-4">
        {STATES.map((s, i) => (
          <div key={s.label} className="relative">
            <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: s.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{s.desc}</p>
            </div>
            {i < STATES.length - 1 && (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="absolute top-1/2 -right-3 z-10 hidden h-5 w-5 -translate-y-1/2 text-[var(--color-text-faint)] sm:block"
              >
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            )}
          </div>
        ))}
      </ScrollReveal>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Tier 1 — Keeper</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
            Fast and narrow. Only flips the halt state machine — nothing else. Run by an automated service that
            follows the issuer&apos;s corporate-action schedule, on its own dedicated key.
          </p>
        </div>
        <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Tier 2 — Multisig</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
            Controls the price oracle directly. No timelock delay here either — pausing and resuming the feed has
            to track real-world events as they happen.
          </p>
        </div>
        <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Tier 3 — Multisig + Timelock</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
            Risk parameters — max LTV, liquidation threshold, liquidation bonus. Rare, high-impact changes get a
            mandatory delay before they can execute.
          </p>
        </div>
      </div>
    </section>
  );
}
