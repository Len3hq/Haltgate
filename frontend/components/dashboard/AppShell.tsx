import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { ProductNav } from "@/components/dashboard/ProductNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-5">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-[var(--color-accent)]" />
              <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">HaltGate</span>
            </Link>
            <div className="hidden min-w-0 sm:block">
              <ProductNav />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
              X Layer Testnet
            </span>
            <WalletConnect />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3 sm:hidden">
          <ProductNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
