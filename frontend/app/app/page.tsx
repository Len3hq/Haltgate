import { AppShell } from "@/components/dashboard/AppShell";
import { NetworkGuard } from "@/components/dashboard/NetworkGuard";
import { MarketStatusStrip } from "@/components/dashboard/MarketStatusStrip";
import { MarketsTable } from "@/components/dashboard/MarketsTable";

export default function MarketsIndexPage() {
  return (
    <AppShell>
      <NetworkGuard>
        <div className="dash-fade-in">
          <MarketStatusStrip />
        </div>

        <div className="dash-fade-in dash-fade-in-1 mt-4">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Markets</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Borrow USDG against tokenized stocks. Each market halts independently when its own corporate action freezes
            the price feed.
          </p>
        </div>

        <div className="dash-fade-in dash-fade-in-2 mt-5">
          <MarketsTable />
        </div>
      </NetworkGuard>
    </AppShell>
  );
}
