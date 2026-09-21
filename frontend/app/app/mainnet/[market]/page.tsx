import { notFound } from "next/navigation";
import { MAINNET_ASSETS, mainnetAssetByKey } from "@/lib/mainnet";
import { MainnetMarketDetail } from "@/components/dashboard/MainnetMarketDetail";

export function generateStaticParams() {
  return MAINNET_ASSETS.map((a) => ({ market: a.key }));
}

export default async function MainnetMarketPage({ params }: { params: Promise<{ market: string }> }) {
  const { market } = await params;
  const asset = mainnetAssetByKey(market);
  if (!asset) notFound();

  return <MainnetMarketDetail asset={asset} />;
}
