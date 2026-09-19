// Live X Layer testnet deployment -- verified on-chain (ownership wiring,
// decimals, initial state) before this file was written.
//
// Each market is an isolated stack: its own collateral token, oracle,
// HaltController, LenderVault, Market and SwapModule. That isolation is the
// point -- halting one stock must leave every other market untouched.
// InterestRateModel and LeverageZap are shared: the rate curve is stateless,
// and the zap takes its market as a call parameter.

export type MarketConfig = {
  /** Stable id used in URLs and as a React key. */
  key: string;
  /** Display name, e.g. "NVIDIA". */
  name: string;
  /** Collateral token symbol, e.g. "wNVDAx". */
  symbol: string;
  /** Real-world ticker for the reference price chart. */
  tradingViewSymbol: string;
  collateral: `0x${string}`;
  faucet: `0x${string}`;
  oracle: `0x${string}`;
  haltController: `0x${string}`;
  lenderVault: `0x${string}`;
  market: `0x${string}`;
  swapModule: `0x${string}`;
};

/** Shared across every market. */
export const SHARED = {
  usdg: "0xF0863D7A29a55d0c4263c11bFac754312ff078DF", // real testnet USDG, 6 decimals
  interestRateModel: "0x5F644BDF606cdb770c76bb01d6c3B83EA9F21845",
  leverageZap: "0xfCB4A5C042fE54e04A7F9027992f06F40F4F55be", // stateless, market passed per call
  multisig: "0x46Af2FD4bF206321Bcd24A58F4497B2681C7716F",
  timelock: "0x6e4591c9A44C28f29F570B19ab82781BA136305F",
} as const;

export const MARKETS: readonly MarketConfig[] = [
  {
    key: "nvda",
    name: "NVIDIA",
    symbol: "wNVDAx",
    tradingViewSymbol: "NASDAQ:NVDA",
    collateral: "0xe37088E75e24AbE5DE1ac6d188803405D9DEbb42",
    faucet: "0xBCFDa358dfdA7d8FFB53e2294846809c5DB8b57D",
    oracle: "0x6092743d17D892c2C6033CF323783Bd7ec5952D4",
    haltController: "0x4C4AC6fd104Eb8CE9887a0e7Da757f86d08EE807",
    lenderVault: "0xAC4F12f02b914A0F35B8bB2955F0052eBF32d789",
    market: "0x446D583F4fF636A3869940Ff4082D979d7bA3B0e",
    swapModule: "0x3797E011686e756EFfb8619B5faDCE261BA59680",
  },
  {
    key: "tsla",
    name: "Tesla",
    symbol: "wTSLAx",
    tradingViewSymbol: "NASDAQ:TSLA",
    collateral: "0x3a18BcB208dCF1A5e65d8243E7337F8be3Bb2A13",
    faucet: "0x2e167DBB68E47c17dc28b7DB6D8A00E896D55692",
    oracle: "0xa15Be4B64b08EEfcc85ad375AD391A167DEdF3E2",
    haltController: "0x0c69EF3ce2fBaCcadAd1d1dbE88C315dB491d649",
    lenderVault: "0x4C7f2B1Cea3bEb9cD9dd9d7BbA20947810EEC73F",
    market: "0x302D52a876e6e81Fc59c7D31704E2e332E608fC1",
    swapModule: "0x10510b248972732b565b333d0Ccfa60493607C21",
  },
  {
    key: "aapl",
    name: "Apple",
    symbol: "wAAPLx",
    tradingViewSymbol: "NASDAQ:AAPL",
    collateral: "0x457e9D75e6ACE368d12442616471EEe28D2Df19c",
    faucet: "0x3a67fF41E0A14EcCFABff32fD4aEd1aD69a75ad1",
    oracle: "0x365262ae56532C1594B42B6C944768E1aAF9caf6",
    haltController: "0x1567e8F41DE5f8a67d3aF33214129AB310149C9A",
    lenderVault: "0x51b0c65Cd795d508a23c7BAf91859CF24f0CAca9",
    market: "0xb34F42528E3FF50D40B0B43fb56919B28c57aDCC",
    swapModule: "0xD1ff0651B9e4111cAaA5C33F3150DdE0451B8019",
  },
  {
    key: "msft",
    name: "Microsoft",
    symbol: "wMSFTx",
    tradingViewSymbol: "NASDAQ:MSFT",
    collateral: "0x4Add596629BddD11C29929A7726873A19A9E95D1",
    faucet: "0x5bbE7FF75476bc86Db13292cB58d8C61a1524094",
    oracle: "0xe722cc0b1C5EadAa69a5deE603954AC71753cc19",
    haltController: "0x4FF088755DcB27F88C5515b17F3263CCB3f7E81c",
    lenderVault: "0x7BC9fc391ADf7aD3EE034e9b830aa9F26288f826",
    market: "0xccDD95fA4aB617202F413EFc3e1C959cdA410bBf",
    swapModule: "0xb4681F6945038E5a7Be56C0aFec01ee8A5c2B0c6",
  },
  {
    key: "spy",
    name: "S&P 500 ETF",
    symbol: "wSPYx",
    tradingViewSymbol: "AMEX:SPY",
    collateral: "0xe28EfB0Eb1A3b17DD59f5E1c3281B0BC147cB313",
    faucet: "0x2F515a5FF950037857cE9a5C62E677057Ef9fca4",
    oracle: "0xD1405dba838e4d01Db8581441f47Cd57D49F7f8E",
    haltController: "0x78aDcB61837Dd42C1AED161F0B3Fd42C57A7ca69",
    lenderVault: "0xfBda6fe34c4827c0ac1267390f5e45FcA75Fc90B",
    market: "0xb8213d2051b75602E435d249fAe1c5E88e571ee5",
    swapModule: "0x4c26B0CB20a985049C7a9817aAFd93C6c93cADd2",
  },
] as const;

/** Flattens a market plus the shared addresses into one lookup object. */
export function marketContracts(m: MarketConfig) {
  return {
    ...SHARED,
    oracle: m.oracle,
    haltController: m.haltController,
    lenderVault: m.lenderVault,
    market: m.market,
    swapModule: m.swapModule,
    wNVDAx: m.collateral,
    wNVDAxFaucet: m.faucet,
  } as const;
}

export function marketByKey(key: string): MarketConfig {
  return MARKETS.find((m) => m.key === key) ?? MARKETS[0];
}

/** Default market. Used by the landing page, which sits outside the provider. */
export const CONTRACTS = marketContracts(MARKETS[0]);

export const USDG_DECIMALS = 6;
export const WNVDAX_DECIMALS = 18; // every mock xStock is 18 decimals
export const VAULT_SHARE_DECIMALS = 6; // vault decimals == USDG's, no offset
