import { AppShell } from "@/components/dashboard/AppShell";
import { NetworkGuard } from "@/components/dashboard/NetworkGuard";
import { HaltStatusBanner } from "@/components/dashboard/HaltStatusBanner";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { PositionPanel } from "@/components/dashboard/PositionPanel";
import { ActionPanel } from "@/components/dashboard/ActionPanel";
import { LiquidatePanel } from "@/components/dashboard/LiquidatePanel";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { TestnetTools } from "@/components/dashboard/TestnetTools";

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
          <div className="dash-fade-in dash-fade-in-2 space-y-4 lg:col-span-2">
            <PositionPanel />
            <ActionPanel />
          </div>
          <div className="dash-fade-in dash-fade-in-2 space-y-4">
            <LiquidatePanel />
            <ActivityFeed />
            <TestnetTools />
          </div>
        </div>
      </NetworkGuard>
    </AppShell>
  );
}
