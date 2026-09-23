import Link from "next/link";
import { Logo } from "@/components/Logo";
import { XIcon, X_URL } from "./XIcon";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">HaltGate</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[var(--color-text-muted)] md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-[var(--color-text)]">
            How it works
          </a>
          <a href="#features" className="transition-colors hover:text-[var(--color-text)]">
            Protection
          </a>
          <a href="#fixed-term" className="transition-colors hover:text-[var(--color-text)]">
            Fixed Term
          </a>
          <a href="#governance" className="transition-colors hover:text-[var(--color-text)]">
            Governance
          </a>
          <Link href="/docs" className="transition-colors hover:text-[var(--color-text)]">
            Docs
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="HaltGate on X"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text"
          >
            <XIcon className="h-4 w-4" />
          </a>
          <Link
            href="/app"
            className="rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-accent-fg)] transition-opacity hover:opacity-90"
          >
            Launch App
          </Link>
        </div>
      </div>
    </header>
  );
}
