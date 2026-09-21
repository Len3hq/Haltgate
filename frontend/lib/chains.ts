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

/// Read-only. The protocol is not deployed here: this chain exists in the app
/// purely so the Mainnet view can show what the real environment looks like,
/// queried live rather than asserted. Every address in lib/mainnet.ts was
/// verified against this RPC before being written down.
export const xLayerMainnet = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.xlayer.tech"] },
  },
  blockExplorers: {
    default: { name: "OKLink", url: "https://www.oklink.com/x-layer" },
  },
});
