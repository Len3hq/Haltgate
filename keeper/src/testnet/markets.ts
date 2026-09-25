import { createPublicClient, defineChain, http, type ContractFunctionParameters } from "viem";
import { SHARED, MARKETS } from "../../../frontend/lib/contracts";
import { config } from "../config";
import { buildWatchlist } from "../watchlist";
import { haltControllerAbi, marketAbi, multicall3TimestampAbi, oracleAbi } from "./abis";

export const xLayerTestnet = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [config.testnetRpcUrl] } },
  contracts: {
    // Canonical deployment, confirmed to have code on chain 1952.
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
  testnet: true,
});

export const testnetClient = createPublicClient({
  chain: xLayerTestnet,
  transport: http(undefined, { timeout: 30_000, retryCount: 2 }),
});

export const MULTISIG = SHARED.multisig as `0x${string}`;

/// The one table that maps a real stock to the testnet market it halts. A
/// corporate action on NVDAx touches the NVIDIA market's contracts and nothing
/// else: the five markets are fully isolated stacks.
export type KeeperMarket = {
  key: string;
  name: string;
  ticker: string;
  oracle: `0x${string}`;
  haltController: `0x${string}`;
  market: `0x${string}`;
};

export function buildKeeperMarkets(only: string[] = []): KeeperMarket[] {
  const watch = buildWatchlist();
  return MARKETS.filter((m) => only.length === 0 || only.includes(m.key)).map((m) => {
    const w = watch.find((x) => x.testnetMarket === m.key);
    if (!w) throw new Error(`no watched ticker maps to testnet market ${m.key}`);
    return {
      key: m.key,
      name: m.name,
      ticker: w.ticker,
      oracle: m.oracle,
      haltController: m.haltController,
      market: m.market,
    };
  });
}

export enum HaltState {
  OPEN = 0,
  HALTING = 1,
  HALTED = 2,
  RESUMING = 3,
  SETTLING = 4,
}

export type MarketChain = {
  state: HaltState;
  haltStartedAt: number;
  price: bigint;
  priceUpdatedAt: number;
  oraclePaused: boolean;
  solvent: boolean;
  maxOracleStaleness: number;
  blockTs: number;
};

/// Every market in one multicall, pinned to one block, with that block's time.
export async function readMarkets(markets: KeeperMarket[]): Promise<Map<string, MarketChain | Error>> {
  const out = new Map<string, MarketChain | Error>();
  const perMarket = (m: KeeperMarket) =>
    [
      { address: m.haltController, abi: haltControllerAbi, functionName: "state" },
      { address: m.haltController, abi: haltControllerAbi, functionName: "haltStartedAt" },
      { address: m.oracle, abi: oracleAbi, functionName: "latestPrice" },
      { address: m.market, abi: marketAbi, functionName: "isSystemSolvent" },
      { address: m.market, abi: marketAbi, functionName: "maxOracleStaleness" },
    ] as const;

  // Typed loosely: viem cannot infer a mixed list, and each result is cast below.
  const contracts: ContractFunctionParameters[] = [
    {
      address: xLayerTestnet.contracts.multicall3.address,
      abi: multicall3TimestampAbi,
      functionName: "getCurrentBlockTimestamp",
    },
    ...markets.flatMap(perMarket),
  ];
  let results;
  try {
    results = await testnetClient.multicall({ allowFailure: true, contracts });
  } catch (err) {
    for (const m of markets) out.set(m.key, err as Error);
    return out;
  }

  const [ts, ...rest] = results;
  if (ts.status !== "success") {
    for (const m of markets) out.set(m.key, new Error("block timestamp read failed"));
    return out;
  }
  const blockTs = Number(ts.result as bigint);

  markets.forEach((m, i) => {
    const r = rest.slice(i * 5, i * 5 + 5);
    const failed = r.find((x) => x.status !== "success");
    if (failed) {
      out.set(m.key, new Error(`read failed: ${String(failed.error).split("\n")[0]}`));
      return;
    }
    const [price, updatedAt, paused] = r[2].result as readonly [bigint, bigint, boolean];
    out.set(m.key, {
      state: Number(r[0].result) as HaltState,
      haltStartedAt: Number(r[1].result as bigint),
      price,
      priceUpdatedAt: Number(updatedAt),
      oraclePaused: paused,
      solvent: r[3].result as boolean,
      maxOracleStaleness: Number(r[4].result as bigint),
      blockTs,
    });
  });
  return out;
}
