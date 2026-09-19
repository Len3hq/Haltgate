import { AppShell } from "@/components/dashboard/AppShell";
import { NetworkGuard } from "@/components/dashboard/NetworkGuard";
import { FixedMarketsTable } from "@/components/dashboard/FixedMarketsTable";

const POINTS = [
  {
    title: "No liquidation, at any price",
    body: "Your position cannot be closed out on price at any point during the term, however far the stock falls. Maturity is the only thing that resolves the loan.",
  },
  {
    title: "The rate is quoted once",
    body: "Total repayable is fixed the moment you borrow and never moves after. No utilization curve, no rate spikes, no surprises at the end.",
  },
  {
    title: "A halt cannot take your collateral",
    body: "Settlement is suspended while a market is halted, so nobody can claim your collateral during a window when the price is frozen. Repaying stays open the whole time.",
  },
];

export default function FixedTermProductPage() {
  return (
    <AppShell>
      <NetworkGuard>
        <div className="dash-fade-in">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-accent)]">Fixed Term</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            No liquidation. Ever.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)]">
            Lock a rate and an end date. Between those two points nothing can close your position out, no matter what the
            stock does. You repay in full and take your collateral back, or the loan ends and the collateral is claimed.
            That is the whole mechanism, and it never reads a price to work.
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
          <FixedMarketsTable />
        </div>

        <p className="dash-fade-in dash-fade-in-3 mt-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
          <span className="font-semibold text-[var(--color-text)]">The tradeoff, stated plainly.</span> You can borrow
          less here than in the variable market. Nothing closes these positions early, so the opening cushion is the only
          protection for the entire term, and losses land on a shared pool rather than on one lender who chose the risk.
          Miss the end date and the whole collateral is claimed, with no partial return.
        </p>
      </NetworkGuard>
    </AppShell>
  );
}
