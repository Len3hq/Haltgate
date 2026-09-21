/// X Layer mainnet (chain 196). HaltGate is NOT deployed here. These are the
/// real, third-party assets the protocol would lend against, listed so the
/// Mainnet view can query them live instead of describing them.
///
/// Every address below was read on-chain on 2026-09-21 before being written
/// here: name, symbol, decimals and supply for each token, and token0/token1/
/// fee/balances for each pool. Addresses were sourced from a third-party
/// repository and treated as unverified until that check passed.

export type MainnetAsset = {
  key: string;
  name: string;
  /// Wrapped token, non-rebasing. This is what a lending market would hold.
  wrapped: `0x${string}`;
  /// Raw token, rebasing. Carries multiplier(), Backed's corporate-action
  /// signal, which is what a mainnet HaltController would watch.
  raw: `0x${string}`;
  /// Uniswap V3 pool against USDG, the only on-chain price source here.
  pool: `0x${string}`;
  /// Real-world ticker, for comparison against the pool's own price.
  ticker: string;
  /// TradingView symbol for the reference chart, same as the testnet markets.
  tradingViewSymbol: string;
};

export const MAINNET_USDG = "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8" as const; // "Global Dollar", 6dp

export const MAINNET_ASSETS: readonly MainnetAsset[] = [
  {
    key: "nvda",
    name: "NVIDIA",
    wrapped: "0xa8ddb5cd96b5222afe198316e9a57caa642850d5",
    raw: "0xc845b2894dbddd03858fd2d643b4ef725fe0849d",
    pool: "0x2a2b11730c2b6d99a58034a869dd810d7300a7b2",
    ticker: "NVDA",
    tradingViewSymbol: "NASDAQ:NVDA",
  },
  {
    key: "spy",
    name: "S&P 500 ETF",
    wrapped: "0xe7e553cd128f0011777323a0b44a7b96ea1cb540",
    raw: "0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48",
    pool: "0x07c40850d14064d20eb0afdef9574675392f2c11",
    ticker: "SPY",
    tradingViewSymbol: "AMEX:SPY",
  },
  {
    key: "tsla",
    name: "Tesla",
    wrapped: "0xc3fdbe3a68ee5de461d30415a8165cf9aefe1171",
    raw: "0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0",
    pool: "0xe1071db4691b325c709854dc3d5ccd5d77e62ed1",
    ticker: "TSLA",
    tradingViewSymbol: "NASDAQ:TSLA",
  },
] as const;

/// Minimal ABIs. Only the functions actually verified as callable.
export const erc20MetaAbi = [
  { type: "function", name: "name", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "totalSupply", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

/// Backed's corporate-action scaling factor, on the RAW token only.
export const multiplierAbi = [
  { type: "function", name: "multiplier", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

export const uniV3PoolAbi = [
  {
    // Always readable, whatever the cardinality. The current tick is the spot
    // price, which is why a missing TWAP never means a missing price.
    type: "function",
    name: "slot0",
    inputs: [],
    outputs: [
      { type: "uint160" },
      { type: "int24" },
      { type: "uint16" },
      { type: "uint16" },
      { type: "uint16" },
      { type: "uint8" },
      { type: "bool" },
    ],
    stateMutability: "view",
  },
  { type: "function", name: "liquidity", inputs: [], outputs: [{ type: "uint128" }], stateMutability: "view" },
] as const;

/// Price of the wrapped token in USDG, from the pool's current tick.
///
/// In every one of these pools USDG is token0 (6dp) and the stock is token1
/// (18dp), verified on-chain. 1.0001^tick gives token1 per token0 in raw
/// units, so the decimal adjustment inverts to a USDG price per whole token.
///
/// Note for when the protocol is actually live here: a lending market would
/// want a time-weighted average rather than the current tick, which is far
/// cheaper to push around. Verified on-chain that NVDA and SPY keep enough
/// observation history to serve one and TSLA does not, so that is a per-pool
/// check rather than an assumption.
export function priceFromTick(tick: number): number | null {
  const raw = Math.pow(1.0001, tick);
  const stockPerUsdg = (raw * 1e6) / 1e18;
  if (!isFinite(stockPerUsdg) || stockPerUsdg <= 0) return null;
  return 1 / stockPerUsdg;
}

export function mainnetAssetByKey(key: string): MainnetAsset | undefined {
  return MAINNET_ASSETS.find((a) => a.key === key);
}
