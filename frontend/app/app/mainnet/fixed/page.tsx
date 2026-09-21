import { MainnetProductPage } from "@/components/dashboard/MainnetProductPage";

export const metadata = { title: "Fixed Term on mainnet | HaltGate" };

export default function MainnetFixedPage() {
  return (
    <MainnetProductPage
      title="Fixed Term"
      tagline="Lock a rate and an end date, with no liquidation for the whole term."
      blurb="Not open on X Layer mainnet yet. These are the real stocks it would lend against; open one to see live prices and pool depth. Fixed-term borrowing works today on testnet."
    />
  );
}
