// Live X Layer testnet deployment -- verified on-chain (ownership wiring,
// decimals, initial state) before this file was written, not just taken
// from deploy-script output. Redeploying? Update these and nothing else
// needs to change -- every component reads from here.
export const CONTRACTS = {
  oracle: "0x6092743d17D892c2C6033CF323783Bd7ec5952D4",
  wNVDAx: "0xe37088E75e24AbE5DE1ac6d188803405D9DEbb42",
  usdg: "0xF0863D7A29a55d0c4263c11bFac754312ff078DF", // real testnet USDG, 6 decimals
  haltController: "0x97729Ad94F5c932C4851D2161eA19877Ff326Ac0",
  lenderVault: "0x03851b5f9569FF61E6e7999382590633E2f123c6", // ERC-4626: USDG in, hgUSDG shares out
  interestRateModel: "0x5F644BDF606cdb770c76bb01d6c3B83EA9F21845",
  market: "0xEB8661722966943e7bD4E217F7E336de374C66b6", // full fresh redeploy: added interest-bearing lending via LenderVault
  multisig: "0x46Af2FD4bF206321Bcd24A58F4497B2681C7716F",
  timelock: "0x6e4591c9A44C28f29F570B19ab82781BA136305F",
} as const;

export const USDG_DECIMALS = 6;
export const WNVDAX_DECIMALS = 18;
export const VAULT_SHARE_DECIMALS = 6; // LenderVault decimals == underlying (USDG) decimals, no offset
