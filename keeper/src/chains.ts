import { defineChain } from "viem";
import { config } from "./config";

// Defined here rather than imported from frontend/lib/chains.ts: that file
// imports viem, which would resolve against frontend/node_modules, and the
// keeper image does not install the frontend's dependencies.
export const xLayerMainnet = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [config.mainnetRpcUrl] } },
  contracts: {
    // Canonical deployment, confirmed to have code on chain 196.
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
});
