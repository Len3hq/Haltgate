// Live X Layer testnet deployment -- verified on-chain (ownership wiring,
// decimals, initial state) before this file was written, not just taken
// from deploy-script output. Redeploying? Update these and nothing else
// needs to change -- every component reads from here.
export const CONTRACTS = {
  oracle: "0x6092743d17D892c2C6033CF323783Bd7ec5952D4",
  wNVDAx: "0xe37088E75e24AbE5DE1ac6d188803405D9DEbb42",
  wNVDAxFaucet: "0xBCFDa358dfdA7d8FFB53e2294846809c5DB8b57D", // self-serve, permissionless, one claim per address
  usdg: "0xF0863D7A29a55d0c4263c11bFac754312ff078DF", // real testnet USDG, 6 decimals
  haltController: "0x4C4AC6fd104Eb8CE9887a0e7Da757f86d08EE807", // + terminal-halt settlement: SETTLING state, 7d settlementDelay, permissionless forceSettle()
  lenderVault: "0x0051f29d5E2BFC85542266a3B9894Da2db2aDf4d", // ERC-4626: USDG in, hgUSDG shares out; pro-rata redemption during SETTLING
  interestRateModel: "0x5F644BDF606cdb770c76bb01d6c3B83EA9F21845",
  market: "0x3ff6a0071655B1179C64f7114b175B141af91978", // setOperator/supplyFor/borrowFor for LeverageZap; interest freeze now covers SETTLING too
  multisig: "0x46Af2FD4bF206321Bcd24A58F4497B2681C7716F",
  timelock: "0x6e4591c9A44C28f29F570B19ab82781BA136305F",
  swapModule: "0x3797E011686e756EFfb8619B5faDCE261BA59680", // oracle-priced wNVDAx<->USDG swap, seeded with 40 wNVDAx, backs LeverageZap
  leverageZap: "0xfCB4A5C042fE54e04A7F9027992f06F40F4F55be", // v2 Milestones 1-2 -- stateless, market-aware: leverage() single pass, multiply() loops to a target multiple
} as const;

export const USDG_DECIMALS = 6;
export const WNVDAX_DECIMALS = 18;
export const VAULT_SHARE_DECIMALS = 6; // LenderVault decimals == underlying (USDG) decimals, no offset
