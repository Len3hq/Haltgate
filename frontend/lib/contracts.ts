// Live X Layer testnet deployment -- verified on-chain (ownership wiring,
// decimals, initial state) before this file was written, not just taken
// from deploy-script output. Redeploying? Update these and nothing else
// needs to change -- every component reads from here.
export const CONTRACTS = {
  oracle: "0x402c7AFF6BD7494ebf339270661a1976B77D0B89",
  wNVDAx: "0x67308b6a10dc5De8203Bd0e213272452D5AF90a7",
  usdg: "0xF0863D7A29a55d0c4263c11bFac754312ff078DF", // real testnet USDG, 6 decimals
  haltController: "0x57aFe2FFdb0d83B4b461E91932f8fF4d155562EF",
  market: "0x5Fb6ad49BB79b00552664d9d4c6e533F871b7B2e", // redeployed: fundMarket() was incorrectly onlyOwner, fixed and redeployed
  multisig: "0xC69ce318cA6Ae032120C404269ae6e8E58B49514",
  timelock: "0x1Fcae2109F9386FE876291F438dD47A4F4C616Ae",
} as const;

export const USDG_DECIMALS = 6;
export const WNVDAX_DECIMALS = 18;
