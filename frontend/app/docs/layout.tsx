import Link from "next/link";
import type { Metadata } from "next";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export const metadata: Metadata = {
  title: "Docs | HaltGate",
  description: "How HaltGate works: halt gating, fixed-term loans, liquidations, settlement and risk parameters.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-[var(--color-accent)]" />
              <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">HaltGate</span>
            </Link>
            <span className="rounded-[var(--radius-pill)] bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
              Docs
            </span>
          </div>
          <Link
            href="/app"
            className="rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-fg)] transition-opacity hover:opacity-90"
          >
            Open app
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <DocsSidebar />
        {children}
      </div>
    </div>
  );
}
