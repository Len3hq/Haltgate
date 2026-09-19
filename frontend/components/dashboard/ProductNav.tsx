"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/// Top-level product surfaces. Fixed Term and Multiply are separate products
/// with their own risk models and parameters, not modes on a position, so they
/// get their own routes rather than sitting behind a tab with no URL.
const PRODUCTS = [
  { href: "/app", label: "Markets" },
  { href: "/app/fixed", label: "Fixed Term" },
  { href: "/app/multiply", label: "Multiply" },
  { href: "/docs", label: "Docs" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") {
    // Markets owns /app and /app/<market>, but not the other products'.
    return (
      pathname === "/app" ||
      (pathname.startsWith("/app/") && !pathname.startsWith("/app/fixed") && !pathname.startsWith("/app/multiply"))
    );
  }
  return pathname.startsWith(href);
}

export function ProductNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {PRODUCTS.map((p) => {
        const active = isActive(pathname, p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
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
