import { AppShell } from "@/components/dashboard/AppShell";
import { NetworkGuard } from "@/components/dashboard/NetworkGuard";
import { MarketProvider } from "@/lib/market-context";
import { MarketsTable } from "@/components/dashboard/MarketsTable";
import { HaltStatusBanner } from "@/components/dashboard/HaltStatusBanner";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { RateCurveChart } from "@/components/dashboard/RateCurveChart";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { TestnetTools } from "@/components/dashboard/TestnetTools";

// Ordered by how urgently each thing matters: which markets exist and which
// are halted -> the selected market's status -> its snapshot -> the action
// the visitor came to take -> supporting context -> testnet plumbing.
export default function DashboardPage() {
  return (
    <AppShell>
      <NetworkGuard>
        <MarketProvider>
          <div className="dash-fade-in">
            <MarketsTable />
          </div>
          <div className="dash-fade-in dash-fade-in-1 mt-4">
            <HaltStatusBanner />
          </div>
          <div className="dash-fade-in dash-fade-in-1 mt-4">
            <MarketOverview />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="dash-fade-in dash-fade-in-2 lg:col-span-2">
              <DashboardTabs />
            </div>
            <div className="dash-fade-in dash-fade-in-2 space-y-4">
              <RateCurveChart />
              <ActivityFeed />
              <TestnetTools />
            </div>
          </div>
        </MarketProvider>
      </NetworkGuard>
    </AppShell>
  );
}
