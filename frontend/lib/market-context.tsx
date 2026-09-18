"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { MARKETS, marketContracts, type MarketConfig } from "@/lib/contracts";

type MarketContextValue = {
  market: MarketConfig;
  setMarketKey: (key: string) => void;
  markets: readonly MarketConfig[];
  contracts: ReturnType<typeof marketContracts>;
};

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [key, setMarketKey] = useState(MARKETS[0].key);
  const value = useMemo(() => {
    const market = MARKETS.find((m) => m.key === key) ?? MARKETS[0];
    return { market, setMarketKey, markets: MARKETS, contracts: marketContracts(market) };
  }, [key]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

function useMarketContext(): MarketContextValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket* must be used inside <MarketProvider>");
  return ctx;
}

/// Same shape the old module-level CONTRACTS constant had, so components read
/// addresses exactly as before -- they just resolve to the selected market.
export function useMarketContracts() {
  return useMarketContext().contracts;
}

export function useSelectedMarket() {
  const { market, setMarketKey, markets } = useMarketContext();
  return { market, setMarketKey, markets };
}
