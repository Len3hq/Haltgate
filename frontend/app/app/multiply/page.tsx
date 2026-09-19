import { AppShell } from "@/components/dashboard/AppShell";
import { NetworkGuard } from "@/components/dashboard/NetworkGuard";
import { MultiplyMarketsTable } from "@/components/dashboard/MultiplyMarketsTable";

const POINTS = [
  {
    title: "One transaction, not ten",
    body: "Supply, borrow, swap and re-supply loop until the position hits your target multiple, all atomically. Either the whole thing lands or none of it does.",
  },
  {
    title: "You pick the multiple",
    body: "Set a target and the loop runs itself. The slider is bounded by the market's own max LTV rather than a hardcoded number, so it stays correct if the parameter moves.",
  },
  {
    title: "Halts stop it cold",
    body: "You cannot lever up into a stock whose price is currently frozen. The same gate that blocks borrowing blocks the loop, checked on-chain rather than hidden in the UI.",
  },
];

export default function MultiplyProductPage() {
  return (
    <AppShell>
      <NetworkGuard>
        <div className="dash-fade-in">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-accent-blue)]">Multiply</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            More exposure, one click.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)]">
            Pick a target multiple and the position loops itself there: borrow against your collateral, swap into more of
            it, supply that too, repeat. This amplifies losses exactly as much as gains, and unlike correlated-asset
            looping your collateral and your debt move independently.
          </p>
        </div>

        <div className="dash-fade-in dash-fade-in-1 mt-6 grid gap-3 sm:grid-cols-3">
          {POINTS.map((p) => (
            <div
              key={p.title}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
            >
              <p className="text-sm font-semibold text-[var(--color-text)]">{p.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="dash-fade-in dash-fade-in-2 mt-6">
          <MultiplyMarketsTable />
        </div>

        <p className="dash-fade-in dash-fade-in-3 mt-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
          <span className="font-semibold text-[var(--color-text)]">These positions can be liquidated.</span> Unlike Fixed
          Term, a multiplied position is a normal variable-rate loan and a price move against you can close it out. The
          ceiling shown per market is an asymptote, so the loop stops as close to your target as liquidity and LTV
          headroom allow rather than reverting on a near miss.
        </p>
      </NetworkGuard>
    </AppShell>
  );
}
