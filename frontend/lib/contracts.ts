// Live X Layer testnet deployment -- verified on-chain (ownership wiring,
// decimals, initial state) before this file was written, not just taken
// from deploy-script output. Redeploying? Update these and nothing else
// needs to change -- every component reads from here.
export const CONTRACTS = {
  oracle: "0x6092743d17D892c2C6033CF323783Bd7ec5952D4",
  wNVDAx: "0xe37088E75e24AbE5DE1ac6d188803405D9DEbb42",
  wNVDAxFaucet: "0xBCFDa358dfdA7d8FFB53e2294846809c5DB8b57D", // self-serve, permissionless, one claim per address
  usdg: "0xF0863D7A29a55d0c4263c11bFac754312ff078DF", // real testnet USDG, 6 decimals
  haltController: "0x97729Ad94F5c932C4851D2161eA19877Ff326Ac0",
  lenderVault: "0x228a292c7E8ee2dc36E8B0cF6B0498192ba3f53d", // ERC-4626: USDG in, hgUSDG shares out
  interestRateModel: "0x5F644BDF606cdb770c76bb01d6c3B83EA9F21845",
  market: "0xf780D228A092c38fc45318611E3fD7723F3eBF0A", // audit fixes: halt-freezes interest, reserves-underflow fix, totalBorrows rounding clamp, reservesAdded precision
  multisig: "0x46Af2FD4bF206321Bcd24A58F4497B2681C7716F",
  timelock: "0x6e4591c9A44C28f29F570B19ab82781BA136305F",
} as const;

export const USDG_DECIMALS = 6;
export const WNVDAX_DECIMALS = 18;
export const VAULT_SHARE_DECIMALS = 6; // LenderVault decimals == underlying (USDG) decimals, no offset
