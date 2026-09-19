import { notFound } from "next/navigation";
import { MARKETS } from "@/lib/contracts";
import { ProductMarketShell } from "@/components/dashboard/ProductMarketShell";
import { FixedTermPanel } from "@/components/dashboard/FixedTermPanel";
import { FixedTermExplainer } from "@/components/dashboard/FixedTermExplainer";

export function generateStaticParams() {
  return MARKETS.map((m) => ({ market: m.key }));
}

export default async function FixedTermMarketPage({ params }: { params: Promise<{ market: string }> }) {
  const { market } = await params;
  if (!MARKETS.some((m) => m.key === market)) notFound();

  return (
    <ProductMarketShell
      marketKey={market}
      basePath="/app/fixed"
      productLabel="Fixed Term"
      panel={<FixedTermPanel />}
    >
      <FixedTermExplainer />
    </ProductMarketShell>
  );
}
