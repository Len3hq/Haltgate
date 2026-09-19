"use client";

import { createContext, useContext, useMemo } from "react";
import { MARKETS, marketContracts, marketByKey, type MarketConfig } from "@/lib/contracts";

type MarketContextValue = {
  market: MarketConfig;
  markets: readonly MarketConfig[];
  contracts: ReturnType<typeof marketContracts>;
};

const MarketContext = createContext<MarketContextValue | null>(null);

/// Driven by the route segment rather than local state -- the URL is the
/// single source of truth for which market is open.
export function MarketProvider({ marketKey, children }: { marketKey: string; children: React.ReactNode }) {
  const value = useMemo(() => {
    const market = marketByKey(marketKey);
    return { market, markets: MARKETS, contracts: marketContracts(market) };
  }, [marketKey]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

function useMarketContext(): MarketContextValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket* must be used inside <MarketProvider>");
  return ctx;
}

/// Same shape the old module-level CONTRACTS constant had, so components read
/// addresses exactly as before -- they just resolve to the routed market.
export function useMarketContracts() {
  return useMarketContext().contracts;
}

/// The routed market's config, for components that need its name or symbol
/// rather than its addresses.
export function useMarketConfig() {
  return useMarketContext().market;
}

/// The routed market's key, for building links that stay on the same asset.
export function useMarketKey() {
  return useMarketContext().market.key;
}
