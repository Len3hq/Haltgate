import Link from "next/link";
import { ScrollReveal } from "./ScrollReveal";

export function CTASection() {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <ScrollReveal>
        <div className="relative overflow-hidden rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-6 py-16 text-center sm:px-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full opacity-[0.14] blur-[100px]"
            style={{ background: "radial-gradient(closest-side, var(--color-accent), transparent)" }}
          />
          <div className="relative">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
              Ready to try it on testnet?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-[var(--color-text-muted)] sm:text-base">
              Connect a wallet on X Layer Testnet, get testnet USDG from the Paxos faucet, and supply your first
              position.
            </p>
            <Link
              href="/app"
              className="mt-8 inline-block rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-8 py-3 text-sm font-semibold text-[var(--color-accent-fg)] transition-transform hover:scale-[1.02]"
            >
              Launch App
            </Link>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
