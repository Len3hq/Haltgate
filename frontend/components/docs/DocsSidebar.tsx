"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS, hrefFor } from "@/lib/docs-nav";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
      {DOCS.map((g) => (
        <div key={g.group}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">{g.group}</p>
          <ul className="mt-2 space-y-0.5">
            {g.pages.map((p) => {
              const href = hrefFor(p.slug);
              const active = pathname === href;
              return (
                <li key={p.slug}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-[var(--radius-card)] px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-[var(--color-bg-elevated)] font-medium text-[var(--color-text)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {p.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebar() {
  return (
    <>
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8">
          <NavList />
        </div>
      </aside>

      {/* Native disclosure on small screens: no JS, keyboard and screen
          reader operable, and it collapses again after you pick a page. */}
      <details className="group mb-6 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-[var(--color-text)]">
          Documentation
          <span className="text-[var(--color-text-faint)] transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-[var(--color-border-subtle)] p-3">
          <NavList />
        </div>
      </details>
    </>
  );
}
