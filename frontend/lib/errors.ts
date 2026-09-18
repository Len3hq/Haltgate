import { BaseError, ContractFunctionRevertedError } from "viem";

// Every custom error our contracts can revert with, mapped to a message a
// user can act on. viem's own shortMessage collapses custom errors (as
// opposed to string require() reasons) to a generic "the function reverted"
// with no indication of why -- the real error name only shows up buried in
// metaMessages, which the UI never rendered. This walks the cause chain to
// find it and looks it up here instead.
const ERROR_MESSAGES: Record<string, string> = {
  // Market.sol
  MarketHalted: "The market isn't open right now -- see the status banner above.",
  ExceedsMaxLTV: "That amount would exceed the maximum loan-to-value ratio.",
  InsufficientCollateral: "You don't have enough collateral supplied for this.",
  InsufficientLiquidity: "The vault doesn't have enough liquid USDG for this right now.",
  InsufficientReserves: "That's more than the protocol's accrued reserves.",
  InvalidReserveFactor: "That reserve factor is above the allowed maximum.",
  ZeroAmount: "Enter an amount greater than zero.",
  ZeroAddress: "That address can't be the zero address.",
  NotLiquidatable: "This position isn't liquidatable -- its health factor is still safe.",
  StaleOracle: "The price feed is stale. Try again shortly.",
  OraclePausedDirectly: "The price feed is paused.",
  NotAuthorized: "You haven't authorized this action on your account yet.",
  // SwapModule.sol
  FeeTooHigh: "That fee is above the allowed maximum.",
  InsufficientInventory: "The swap doesn't have enough of that token available right now.",
  // LeverageZap.sol
  MismatchedSwapModule: "That swap contract doesn't match this market's collateral/debt pair.",
  SlippageTooHigh: "The swap output was lower than the minimum you allowed -- try again.",
  // HaltController.sol
  WrongState: "The market isn't in the right state for that action right now.",
  NotSettleable: "This market isn't eligible for settlement -- it's either operating normally or already settling.",
  HaltTooRecent: "The halt hasn't run long enough yet for settlement to be forced.",
  InvalidSettlementDelay: "That settlement delay is outside the allowed range.",
  // MockPausableOracle.sol
  OraclePaused: "The price feed is paused.",
  OracleNotPaused: "The price feed isn't paused.",
  // LenderVault.sol
  OnlyMarket: "Only the Market contract can do that.",
  MarketAlreadySet: "The vault is already wired to a market.",
  // WNVDAxFaucet.sol
  AlreadyClaimed: "This address has already claimed from the faucet.",
  // OpenZeppelin ERC20 (insufficient allowance/balance on supply/borrow/repay/liquidate)
  ERC20InsufficientAllowance: "Approve a higher amount first.",
  ERC20InsufficientBalance: "Insufficient balance for this amount.",
  // OpenZeppelin ERC4626 (LenderVault deposit/withdraw limits)
  ERC4626ExceededMaxDeposit: "That's more than the vault currently accepts.",
  ERC4626ExceededMaxMint: "That's more shares than the vault currently accepts.",
  ERC4626ExceededMaxWithdraw: "That's more than is currently liquid in the vault -- the rest is out on loan.",
  ERC4626ExceededMaxRedeem: "That's more shares than you can currently redeem -- part of the vault's cash is out on loan.",
};

export function getErrorMessage(error: Error | null | undefined): string | undefined {
  if (!error) return undefined;

  if (error instanceof BaseError) {
    const revertError = error.walk((e) => e instanceof ContractFunctionRevertedError) as
      | ContractFunctionRevertedError
      | undefined;
    const errorName = revertError?.data?.errorName;
    if (errorName && ERROR_MESSAGES[errorName]) return ERROR_MESSAGES[errorName];
    if (error.shortMessage) return error.shortMessage;
  }

  return error.message.split("\n")[0];
}
