import { MAINNET_ASSETS } from "../../frontend/lib/mainnet";
import { MARKETS } from "../../frontend/lib/contracts";

// Built from the frontend's two registries rather than a copy of them, so a
// redeploy that updates frontend/lib/contracts.ts cannot leave the keeper
// watching the wrong market.

export type Watched = {
  /// Real-world ticker, e.g. "NVDA".
  ticker: string;
  /// Symbol on the xStocks API, e.g. "NVDAx".
  apiSymbol: string;
  /// Raw (rebasing) xStock on X Layer mainnet, which carries the on-chain
  /// schedule. Absent when there is no X Layer token (Microsoft).
  raw?: `0x${string}`;
  /// Testnet market this ticker will drive once the keeper acts on it
  /// (Phase 1). Absent for mainnet-only tokens, watched purely for data.
  testnetMarket?: string;
};

function tickerOf(tradingViewSymbol: string): string {
  return tradingViewSymbol.split(":").pop()!;
}

export function buildWatchlist(): Watched[] {
  const list: Watched[] = MAINNET_ASSETS.map((a) => ({
    ticker: a.ticker,
    apiSymbol: `${a.ticker}x`,
    raw: a.raw,
    testnetMarket: MARKETS.find((m) => m.key === a.key)?.key,
  }));

  for (const m of MARKETS) {
    const ticker = tickerOf(m.tradingViewSymbol);
    if (!list.some((w) => w.ticker === ticker)) {
      list.push({ ticker, apiSymbol: `${ticker}x`, testnetMarket: m.key });
    }
  }
  return list;
}
