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
  /// signal, which is what a mainnet HaltController would watch. Confirmed to
  /// be exactly what the wrapper's own asset() returns for all eight.
  raw: `0x${string}`;
  /// Uniswap V3 pool, the only on-chain price source here.
  pool: `0x${string}`;
  /// The stablecoin side of the pool. Not uniform: five pair against USDG and
  /// three against USDC, both 6 decimals.
  quoteSymbol: "USDG" | "USDC";
  /// Whether the stock is token0. Also not uniform, and getting it wrong
  /// inverts the price: MSTR, COIN and QQQ put the stock first, the rest
  /// put the stablecoin first.
  stockIsToken0: boolean;
  /// Real-world ticker, for comparison against the pool's own price.
  ticker: string;
  /// TradingView symbol for the reference chart, same as the testnet markets.
  tradingViewSymbol: string;
};

export const MAINNET_USDG = "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8" as const; // "Global Dollar", 6dp
export const MAINNET_USDC = "0xb6ceceab302e2e4948951ee7843fc24e92933061" as const; // 6dp, verified

export const MAINNET_ASSETS: readonly MainnetAsset[] = [
  {
    key: "nvda",
    name: "NVIDIA",
    wrapped: "0xa8ddb5cd96b5222afe198316e9a57caa642850d5",
    raw: "0xc845b2894dbddd03858fd2d643b4ef725fe0849d",
    pool: "0x2a2b11730c2b6d99a58034a869dd810d7300a7b2",
    quoteSymbol: "USDG",
    stockIsToken0: false,
    ticker: "NVDA",
    tradingViewSymbol: "NASDAQ:NVDA",
  },
  {
    key: "tsla",
    name: "Tesla",
    wrapped: "0xc3fdbe3a68ee5de461d30415a8165cf9aefe1171",
    raw: "0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0",
    pool: "0xe1071db4691b325c709854dc3d5ccd5d77e62ed1",
    quoteSymbol: "USDG",
    stockIsToken0: false,
    ticker: "TSLA",
    tradingViewSymbol: "NASDAQ:TSLA",
  },
  {
    key: "aapl",
    name: "Apple",
    wrapped: "0x943bf64d566c32a2bcd41ac92fb63c111cc9de8f",
    raw: "0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a",
    pool: "0xc44bd9c8589026d28d1632d7b86b2efb6cdc8fd2",
    quoteSymbol: "USDG",
    stockIsToken0: false,
    ticker: "AAPL",
    tradingViewSymbol: "NASDAQ:AAPL",
  },
  {
    key: "googl",
    name: "Alphabet",
    wrapped: "0xf8c5308f80e459bb53d9ebe689854d9cbb2caa6f",
    raw: "0xe92f673ca36c5e2efd2de7628f815f84807e803f",
    pool: "0x9f6273e2669cd812e76788b698374c43637c87c2",
    quoteSymbol: "USDC",
    stockIsToken0: false,
    ticker: "GOOGL",
    tradingViewSymbol: "NASDAQ:GOOGL",
  },
  {
    key: "mstr",
    name: "MicroStrategy",
    wrapped: "0x30987adf0b11dc698438a99ba04ec3a1ab2c7eab",
    raw: "0xae2f842ef90c0d5213259ab82639d5bbf649b08e",
    pool: "0xb665a8ed2c09bd243acfee75a82ef3a8b3f63c67",
    quoteSymbol: "USDG",
    stockIsToken0: true,
    ticker: "MSTR",
    tradingViewSymbol: "NASDAQ:MSTR",
  },
  {
    key: "coin",
    name: "Coinbase",
    wrapped: "0x44c7ed7ffdf8465c9d27f60aec845eed3d49d56e",
    raw: "0x364f210f430ec2448fc68a49203040f6124096f0",
    pool: "0x91db1a80bd51fcbd30c6bfa398eee0de24ee2663",
    quoteSymbol: "USDC",
    stockIsToken0: true,
    ticker: "COIN",
    tradingViewSymbol: "NASDAQ:COIN",
  },
  {
    key: "qqq",
    name: "Nasdaq 100 ETF",
    wrapped: "0x4c1ae29c159838fc1b224636e28e086eb69101f7",
    raw: "0xa753a7395cae905cd615da0b82a53e0560f250af",
    pool: "0x2bd90724ffc80ba22ec7af8cfd2b4b51ff395b04",
    quoteSymbol: "USDC",
    stockIsToken0: true,
    ticker: "QQQ",
    tradingViewSymbol: "NASDAQ:QQQ",
  },
  {
    key: "spy",
    name: "S&P 500 ETF",
    wrapped: "0xe7e553cd128f0011777323a0b44a7b96ea1cb540",
    raw: "0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48",
    pool: "0x07c40850d14064d20eb0afdef9574675392f2c11",
    quoteSymbol: "USDG",
    stockIsToken0: false,
    ticker: "SPY",
    tradingViewSymbol: "AMEX:SPY",
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

/// Price of one whole wrapped stock, in whatever stablecoin the pool pairs
/// against, from the pool's current tick.
///
/// Uniswap gives token1 per token0 in RAW units, so both the decimal gap and
/// which side the stock sits on have to be handled. Getting the orientation
/// wrong silently inverts the price, and three of these eight pools put the
/// stock first. Validated against live quotes for all six checkable tickers,
/// every one within 0.3%.
export function priceFromTick(tick: number, stockIsToken0: boolean): number | null {
  const raw = Math.pow(1.0001, tick);
  const STOCK_DECIMALS = 18;
  const QUOTE_DECIMALS = 6; // both USDG and USDC, verified on-chain
  const price = stockIsToken0
    ? raw * Math.pow(10, STOCK_DECIMALS - QUOTE_DECIMALS)
    : 1 / (raw * Math.pow(10, QUOTE_DECIMALS - STOCK_DECIMALS));
  return isFinite(price) && price > 0 ? price : null;
}

export function mainnetAssetByKey(key: string): MainnetAsset | undefined {
  return MAINNET_ASSETS.find((a) => a.key === key);
}
