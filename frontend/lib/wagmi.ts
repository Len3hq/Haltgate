import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { xLayerTestnet } from "./chains";

// injected() + wagmi's default multi-injected-provider discovery (EIP-6963)
// picks up any installed browser wallet -- OKX Wallet, MetaMask, etc. --
// without needing a per-wallet connector package.
export const wagmiConfig = createConfig({
  chains: [xLayerTestnet],
  connectors: [injected()],
  transports: {
    [xLayerTestnet.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
