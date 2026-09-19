import { notFound } from "next/navigation";
import { MARKETS } from "@/lib/contracts";
import { MarketDetail } from "@/components/dashboard/MarketDetail";

// Five known markets, so prerender all of them rather than rendering on demand.
export function generateStaticParams() {
  return MARKETS.map((m) => ({ market: m.key }));
}

export default async function MarketDetailPage({ params }: { params: Promise<{ market: string }> }) {
  const { market } = await params;
  if (!MARKETS.some((m) => m.key === market)) notFound();

  return <MarketDetail marketKey={market} />;
}
