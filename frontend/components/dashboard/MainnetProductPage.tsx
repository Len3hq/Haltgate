import { AppShell } from "@/components/dashboard/AppShell";
import { MainnetNotice } from "@/components/dashboard/MainnetNotice";
import { MainnetMarketsTable } from "@/components/dashboard/MainnetMarketsTable";

/// Mainnet counterparts of the Fixed Term and Multiply product pages. They
/// exist so the product nav has somewhere to go while you are on mainnet:
/// without them, clicking a product bounced you back to testnet, silently
/// changing network behind your back.
export function MainnetProductPage({
  title,
  tagline,
  blurb,
}: {
  title: string;
  tagline: string;
  blurb: string;
}) {
  return (
    <AppShell>
      <MainnetNotice />

      <div className="dash-fade-in">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{title}</h1>
          <span className="rounded-[var(--radius-pill)] bg-[var(--color-warning-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-warning)]">
            Mainnet, not live
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">{tagline}</p>
      </div>

      <p className="dash-fade-in dash-fade-in-1 mt-4 max-w-2xl rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
        {blurb}
      </p>

      <div className="dash-fade-in dash-fade-in-2 mt-5">
        <MainnetMarketsTable />
      </div>
    </AppShell>
  );
}
