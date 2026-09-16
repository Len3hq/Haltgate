import { defineChain } from "viem";

// Confirmed throughout the project's research: chain ID 1952 is the
// current X Layer testnet (195 is deprecated, 196 is mainnet). RPC and
// explorer match foundry.toml / the deployment already verified on-chain.
export const xLayerTestnet = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testrpc.xlayer.tech/terigon"] },
  },
  blockExplorers: {
    default: { name: "OKLink", url: "https://www.oklink.com/x-layer-testnet" },
  },
  testnet: true,
});
