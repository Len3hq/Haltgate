"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/// The network badge, turned into a view switch.
///
/// Deliberately NOT a wallet network switch. Mainnet here is a read-only view
/// of real assets; the protocol is not deployed there and nothing on that page
/// can be transacted with. Prompting a wallet to change chains would imply
/// otherwise, so this only ever navigates.
export function NetworkSwitcher() {
  const pathname = usePathname();
  const onMainnet = pathname.startsWith("/app/mainnet");

  const base =
    "flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs transition-colors whitespace-nowrap";

  return (
    <div className="flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] p-0.5">
      <Link
        href="/app"
        aria-current={!onMainnet ? "page" : undefined}
        className={`${base} ${
          !onMainnet
            ? "bg-[var(--color-bg-elevated)] text-[var(--color-text)]"
            : "text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
        Testnet
      </Link>

      <Link
        href="/app/mainnet"
        aria-current={onMainnet ? "page" : undefined}
        className={`${base} ${
          onMainnet
            ? "bg-[var(--color-bg-elevated)] text-[var(--color-text)]"
            : "text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)]" />
        Mainnet
      </Link>
    </div>
  );
}
