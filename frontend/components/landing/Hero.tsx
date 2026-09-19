"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { LiveMarketStats } from "./LiveMarketStats";

export function Hero() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(".hero-reveal", { opacity: 0, y: 20 });
        gsap.to(".hero-reveal", {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power2.out",
          stagger: 0.1,
          delay: 0.1,
        });
      });
      return () => mm.revert();
    },
    { scope }
  );

  return (
    <section ref={scope} className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.18] blur-[120px]"
        style={{ background: "radial-gradient(closest-side, var(--color-accent), transparent)" }}
      />
      <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
        <span className="hero-reveal inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
          Live on X Layer Testnet
        </span>

        <h1 className="hero-reveal mt-6 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-text)] sm:text-6xl">
          Borrow against tokenized stocks.
          <br />
          <span className="text-[var(--color-accent)]">Protected when the market isn&apos;t trading.</span>
        </h1>

        <p className="hero-reveal mx-auto mt-6 max-w-2xl text-balance text-base text-[var(--color-text-muted)] sm:text-lg">
          HaltGate is a credit desk for xStocks collateral that automatically freezes risk the moment a corporate
          action halts trading — so you&apos;re never liquidated against a stale price, and the pool is never left
          exposed to one.
        </p>

        <div className="hero-reveal mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/app"
            className="w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-7 py-3 text-sm font-semibold text-[var(--color-accent-fg)] transition-transform hover:scale-[1.02] sm:w-auto"
          >
            Launch App
          </Link>
          <a
            href="#how-it-works"
            className="w-full rounded-[var(--radius-pill)] border border-[var(--color-border)] px-7 py-3 text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-text-muted)] sm:w-auto"
          >
            See how it works
          </a>
        </div>

        <div className="hero-reveal mt-14">
          <LiveMarketStats />
        </div>
      </div>
    </section>
  );
}
