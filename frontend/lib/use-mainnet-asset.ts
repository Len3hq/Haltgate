"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { xLayerMainnet } from "@/lib/chains";
import {
  MAINNET_USDG,
  erc20MetaAbi,
  multiplierAbi,
  uniV3PoolAbi,
  priceFromTicks,
  priceFromTick,
  TWAP_WINDOW,
  type MainnetAsset,
} from "@/lib/mainnet";

/// Live chain-196 state for one asset. Shared by the markets table and the
/// detail page so the two can never disagree about what is on chain.
export function useMainnetAsset(asset: MainnetAsset) {
  const poll = { refetchInterval: 30_000 };

  const { data: meta } = useReadContracts({
    contracts: [
      { chainId: xLayerMainnet.id, address: asset.wrapped, abi: erc20MetaAbi, functionName: "symbol" },
      { chainId: xLayerMainnet.id, address: asset.wrapped, abi: erc20MetaAbi, functionName: "totalSupply" },
      { chainId: xLayerMainnet.id, address: asset.raw, abi: multiplierAbi, functionName: "multiplier" },
      {
        chainId: xLayerMainnet.id,
        address: MAINNET_USDG,
        abi: erc20MetaAbi,
        functionName: "balanceOf",
        args: [asset.pool],
      },
      {
        chainId: xLayerMainnet.id,
        address: asset.wrapped,
        abi: erc20MetaAbi,
        functionName: "balanceOf",
        args: [asset.pool],
      },
    ],
    query: poll,
  });

  // Spot, from the current tick. Works on every pool: slot0 has no
  // cardinality requirement, so a pool without TWAP history still has a price.
  const { data: slot0 } = useReadContract({
    chainId: xLayerMainnet.id,
    address: asset.pool,
    abi: uniV3PoolAbi,
    functionName: "slot0",
    query: poll,
  });

  // TWAP is the better number where the pool can serve one. Availability turns
  // on observationCardinality, not liquidity: NVDA and SPY are at 256, TSLA at
  // 1, so TSLA reverts here while still having a perfectly readable spot price.
  const { data: ticks } = useReadContract({
    chainId: xLayerMainnet.id,
    address: asset.pool,
    abi: uniV3PoolAbi,
    functionName: "observe",
    args: [[TWAP_WINDOW, 0]],
    query: { ...poll, enabled: asset.twapAvailable },
  });

  const usdgRaw = meta?.[3]?.result as bigint | undefined;
  const usdgInPool = usdgRaw !== undefined ? Number(formatUnits(usdgRaw, 6)) : undefined;
  const stockRaw = meta?.[4]?.result as bigint | undefined;
  const supplyRaw = meta?.[1]?.result as bigint | undefined;
  const multiplierRaw = meta?.[2]?.result as bigint | undefined;

  return {
    symbol: meta?.[0]?.result as string | undefined,
    supply: supplyRaw !== undefined ? Number(formatUnits(supplyRaw, 18)) : undefined,
    multiplier: multiplierRaw !== undefined ? Number(formatUnits(multiplierRaw, 18)) : undefined,
    usdgInPool,
    stockInPool: stockRaw !== undefined ? Number(formatUnits(stockRaw, 18)) : undefined,
    spot: slot0 ? priceFromTick(Number(slot0[1])) : null,
    twap: ticks ? priceFromTicks(ticks[0] as readonly bigint[], TWAP_WINDOW) : null,
    observationCardinality: slot0 ? Number(slot0[3]) : undefined,
    /// Depth flag, separate from price availability. The two are independent:
    /// a thin pool can still quote, and a deep pool can still lack TWAP history.
    thin: usdgInPool === undefined ? undefined : usdgInPool < 50_000,
  };
}
