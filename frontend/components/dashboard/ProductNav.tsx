"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/// Top-level product surfaces. Fixed Term and Multiply are separate products
/// with their own risk models and parameters, not modes on a position, so they
/// get their own routes rather than sitting behind a tab with no URL.
///
/// Network-aware. These links were hardcoded to the testnet routes, so
/// clicking a product while viewing mainnet silently threw you back onto
/// testnet. Changing network is the switcher's job and nothing else's.
const PRODUCTS = [
  { segment: "", label: "Markets" },
  { segment: "/fixed", label: "Fixed Term" },
  { segment: "/multiply", label: "Multiply" },
];

const MAINNET_ROOT = "/app/mainnet";

export function ProductNav() {
  const pathname = usePathname();
  const onMainnet = pathname.startsWith(MAINNET_ROOT);
  const root = onMainnet ? MAINNET_ROOT : "/app";

  const hrefFor = (segment: string) => (segment === "" ? root : `${root}${segment}`);

  function isActive(segment: string): boolean {
    if (segment !== "") return pathname.startsWith(hrefFor(segment));

    // "Markets" owns the root and its market detail pages, but not the other
    // products'. On testnet it must also not claim the whole mainnet subtree.
    const siblings = PRODUCTS.filter((p) => p.segment !== "").map((p) => hrefFor(p.segment));
    const excluded = onMainnet ? siblings : [...siblings, MAINNET_ROOT];
    return pathname === root || (pathname.startsWith(`${root}/`) && !excluded.some((e) => pathname.startsWith(e)));
  }

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {PRODUCTS.map((p) => {
        const active = isActive(p.segment);
        return (
          <Link
            key={p.label}
            href={hrefFor(p.segment)}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-[var(--radius-pill)] px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--color-bg-elevated)] text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
