"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { xLayerMainnet } from "@/lib/chains";
import {
  MAINNET_USDG,
  MAINNET_USDC,
  erc20MetaAbi,
  multiplierAbi,
  uniV3PoolAbi,
  priceFromTick,
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
        address: asset.quoteSymbol === "USDC" ? MAINNET_USDC : MAINNET_USDG,
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

  // Current price from the pool's tick. Every pool can serve this; only some
  // keep the observation history a time-weighted average would need, which is
  // a distinction worth making once the protocol is actually live here.
  const { data: slot0 } = useReadContract({
    chainId: xLayerMainnet.id,
    address: asset.pool,
    abi: uniV3PoolAbi,
    functionName: "slot0",
    query: poll,
  });

  // Whichever stablecoin this pool pairs against; both are 6 decimals.
  const quoteRaw = meta?.[3]?.result as bigint | undefined;
  const usdgInPool = quoteRaw !== undefined ? Number(formatUnits(quoteRaw, 6)) : undefined;
  const stockRaw = meta?.[4]?.result as bigint | undefined;
  const supplyRaw = meta?.[1]?.result as bigint | undefined;
  const multiplierRaw = meta?.[2]?.result as bigint | undefined;

  return {
    symbol: meta?.[0]?.result as string | undefined,
    supply: supplyRaw !== undefined ? Number(formatUnits(supplyRaw, 18)) : undefined,
    multiplier: multiplierRaw !== undefined ? Number(formatUnits(multiplierRaw, 18)) : undefined,
    quoteInPool: usdgInPool,
    quoteSymbol: asset.quoteSymbol,
    stockInPool: stockRaw !== undefined ? Number(formatUnits(stockRaw, 18)) : undefined,
    price: slot0 ? priceFromTick(Number(slot0[1]), asset.stockIsToken0) : null,
    /// Depth flag, separate from price availability. The two are independent:
    /// a thin pool can still quote, and a deep pool can still lack TWAP history.
    thin: usdgInPool === undefined ? undefined : usdgInPool < 50_000,
  };
}
