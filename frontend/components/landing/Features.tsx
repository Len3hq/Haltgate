import { ScrollReveal } from "./ScrollReveal";

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path d="M12 3l8 4-8 4-8-4 8-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 12l8 4 8-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16l8 4 8-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ScaleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path d="M12 3v18M5 8l-3 6a3 3 0 006 0l-3-6zM19 8l-3 6a3 3 0 006 0l-3-6zM5 8h14M9 21h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function GaugeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path d="M4 15a8 8 0 1116 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 15l4-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 12.5l2.2 2.2L16 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FEATURES = [
  { icon: ShieldIcon, title: "Halt-aware by design", body: "Borrowing and liquidations freeze market-wide the instant a corporate action pauses the price feed — not after the fact." },
  { icon: LayersIcon, title: "Three-tier governance", body: "A fast, narrow keeper for time-sensitive halts; a multisig for oracle control; a multisig + timelock for risk parameters." },
  { icon: GaugeIcon, title: "Decimals-safe accounting", body: "Every value comparison is normalized to an internal 18-decimal WAD, so a 6-decimal debt token and an 18-decimal collateral token never get compared incorrectly." },
  { icon: LockIcon, title: "Hardened against reentrancy", body: "Every state-changing function is reentrancy-guarded, and oracle freshness is checked independently of the halt state machine itself." },
  { icon: ScaleIcon, title: "Open, permissionless liquidations", body: "Anyone can liquidate an undercollateralized position for a fixed bonus — capped by a close factor so one price move can't wipe a position in a single call." },
  { icon: CheckIcon, title: "Slither-clean, fully tested", body: "120 tests across the full lifecycle — decimals, reentrancy, oracle staleness, governance, and the halt state machine itself." },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">Protection</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
          Built for what real stocks actually do
        </h2>
      </div>

      <ScrollReveal className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 transition-colors hover:border-[var(--color-border-subtle)]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] text-[var(--color-accent)]">
              <f.icon />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[var(--color-text)]">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{f.body}</p>
          </div>
        ))}
      </ScrollReveal>
    </section>
  );
}
