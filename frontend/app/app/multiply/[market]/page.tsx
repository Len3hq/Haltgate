import { notFound } from "next/navigation";
import { MARKETS } from "@/lib/contracts";
import { ProductMarketShell } from "@/components/dashboard/ProductMarketShell";
import { LeveragePanel } from "@/components/dashboard/LeveragePanel";
import { RateCurveChart } from "@/components/dashboard/RateCurveChart";

export function generateStaticParams() {
  return MARKETS.map((m) => ({ market: m.key }));
}

export default async function MultiplyMarketPage({ params }: { params: Promise<{ market: string }> }) {
  const { market } = await params;
  if (!MARKETS.some((m) => m.key === market)) notFound();

  return (
    <ProductMarketShell marketKey={market} basePath="/app/multiply" productLabel="Multiply" panel={<LeveragePanel />}>
      {/* A looped position pays the variable borrow rate, so the curve it sits
          on is the thing that decides whether the trade stays worthwhile. */}
      <RateCurveChart />
    </ProductMarketShell>
  );
}
