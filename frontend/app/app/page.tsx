import { AppShell } from "@/components/dashboard/AppShell";
import { NetworkGuard } from "@/components/dashboard/NetworkGuard";
import { HaltStatusBanner } from "@/components/dashboard/HaltStatusBanner";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { RateCurveChart } from "@/components/dashboard/RateCurveChart";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { TestnetTools } from "@/components/dashboard/TestnetTools";

// Structured top-to-bottom by how urgently each thing matters: halt status
// (can block everything below it) -> market snapshot -> the rate curve that
// explains *why* those rates are what they are -> the one action a given
// visitor actually came to take (DashboardTabs, persona-scoped instead of
// every flow's cards stacked at once) -> a lower-priority activity log ->
// testnet plumbing, collapsed, at the very bottom.
export default function DashboardPage() {
  return (
    <AppShell>
      <NetworkGuard>
        <div className="dash-fade-in">
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
      </NetworkGuard>
    </AppShell>
  );
}
