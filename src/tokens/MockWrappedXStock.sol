// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Test-only stand-in for wNVDAx (confirmed liquid on X Layer, ~$588K
/// USDG pool). Wrapped xStocks are confirmed non-rebasing by design: balances
/// stay fixed and corporate-action value changes (dividends, splits) accrue
/// via an increasing exchange rate instead, wstETH-style. This contract only
/// simulates the collateral asset's own behavior — it is deliberately
/// unaware of HaltGate's oracle/pause state, matching the real world: Backed
/// controls this token, HaltGate's market is what must respect the oracle's
/// paused status before trusting any price derived from it.
contract MockWrappedXStock is ERC20, Ownable {
    uint256 public exchangeRate; // 18 decimals, shares -> underlying value
    uint8 private constant _DECIMALS = 18;

    event ExchangeRateUpdated(uint256 previousRate, uint256 newRate);

    constructor(address owner_) ERC20("Mock Wrapped NVIDIA xStock", "wNVDAx-MOCK") Ownable(owner_) {
        exchangeRate = 1e18;
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Value represented by `shares` tokens at the current exchange rate.
    /// Balances never change from this — only the rate does, matching the
    /// confirmed non-rebasing wrapped-xStock design.
    function valueOf(uint256 shares) public view returns (uint256) {
        return (shares * exchangeRate) / 1e18;
    }

    /// @notice Simulates the wrapper accruing a corporate-action value change
    /// (dividend reinvestment or split adjustment) into the exchange rate.
    function setExchangeRate(uint256 newRate) external onlyOwner {
        emit ExchangeRateUpdated(exchangeRate, newRate);
        exchangeRate = newRate;
    }

    /// @notice Test-only faucet for seeding collateral balances.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
