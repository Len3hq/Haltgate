import { ScrollReveal } from "./ScrollReveal";

const STEPS = [
  {
    step: "01",
    title: "Supply xStocks collateral",
    body: "Deposit wrapped, tokenized stock (wNVDAx) as collateral. Value accrues through the wrapper's own exchange rate — your balance doesn't rebase under you.",
  },
  {
    step: "02",
    title: "Borrow USDG against it",
    body: "Borrow up to a fixed max LTV. Every value comparison is normalized internally, so collateral and debt in different decimals are never mixed up.",
  },
  {
    step: "03",
    title: "Trading halts, HaltGate freezes with it",
    body: "The instant the exchange halts the underlying stock and the price oracle pauses, new borrowing and all liquidations stop market-wide — automatically.",
  },
  {
    step: "04",
    title: "Repay anytime, resume when price is live",
    body: "Repaying your own debt is never blocked, even mid-halt. Once real trading resumes and a fresh price lands, the market reopens in a deliberate, ordered sequence.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">How it works</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
          A lending market that knows the exchange can close
        </h2>
      </div>

      <ScrollReveal className="mt-12 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s) => (
          <div
            key={s.step}
            className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 transition-colors hover:border-[var(--color-border-subtle)]"
          >
            <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-accent)]">{s.step}</span>
            <h3 className="mt-3 text-lg font-semibold text-[var(--color-text)]">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{s.body}</p>
          </div>
        ))}
      </ScrollReveal>
    </section>
  );
}
