import { FaucetPanel } from "./FaucetPanel";

// Faucet access isn't a real product feature -- it's testnet-only plumbing.
// A native <details> disclosure keeps it out of the way of the actual
// lending flow while staying fully keyboard- and screen-reader-operable
// without any custom JS.
export function TestnetTools() {
  return (
    <details className="group rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs uppercase tracking-wide text-[var(--color-text-faint)]">
        Testnet Tools
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
        <FaucetPanel />
      </div>
    </details>
  );
}
