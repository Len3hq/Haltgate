import { Header } from "@/components/Header";
import { HaltStatusBanner } from "@/components/HaltStatusBanner";
import { MarketOverview } from "@/components/MarketOverview";
import { PositionPanel } from "@/components/PositionPanel";
import { ActionPanel } from "@/components/ActionPanel";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <HaltStatusBanner />
        <MarketOverview />
        <PositionPanel />
        <ActionPanel />
      </main>
    </>
  );
}
