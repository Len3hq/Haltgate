import { AppShell } from "@/components/dashboard/AppShell";
import { MainnetNotice } from "@/components/dashboard/MainnetNotice";
import { MainnetMarketsTable } from "@/components/dashboard/MainnetMarketsTable";

export const metadata = {
  title: "Mainnet | HaltGate",
  description: "Real X Layer mainnet markets HaltGate would lend against, queried live.",
};

export default function MainnetPage() {
  return (
    <AppShell>
      <MainnetNotice />

      <div className="dash-fade-in">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Markets</h1>
          <span className="rounded-[var(--radius-pill)] bg-[var(--color-warning-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-warning)]">
            Mainnet, not live
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Real assets on X Layer, read live from chain 196. Browsing works; supplying and borrowing do not.
        </p>
      </div>

      <div className="dash-fade-in dash-fade-in-1 mt-5">
        <MainnetMarketsTable />
      </div>
    </AppShell>
  );
}
