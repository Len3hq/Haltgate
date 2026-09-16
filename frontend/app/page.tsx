import { Header } from "@/components/Header";
import { NetworkGuard } from "@/components/NetworkGuard";
import { HaltStatusBanner } from "@/components/HaltStatusBanner";
import { MarketOverview } from "@/components/MarketOverview";
import { PositionPanel } from "@/components/PositionPanel";
import { ActionPanel } from "@/components/ActionPanel";
import { LiquidatePanel } from "@/components/LiquidatePanel";
import { FaucetPanel } from "@/components/FaucetPanel";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <NetworkGuard>
          <HaltStatusBanner />
          <MarketOverview />
          <PositionPanel />
          <ActionPanel />
          <LiquidatePanel />
          <FaucetPanel />
        </NetworkGuard>
      </main>
    </>
  );
}
