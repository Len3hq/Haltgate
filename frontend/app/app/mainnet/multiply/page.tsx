import { MainnetProductPage } from "@/components/dashboard/MainnetProductPage";

export const metadata = { title: "Multiply on mainnet | HaltGate" };

export default function MainnetMultiplyPage() {
  return (
    <MainnetProductPage
      title="Multiply"
      tagline="Loop into amplified exposure in a single transaction."
      blurb="Not open on X Layer mainnet yet. Looping needs somewhere to swap, and the pool depth shown below is exactly what would cap how large a position each market could support. Multiply works today on testnet."
    />
  );
}
