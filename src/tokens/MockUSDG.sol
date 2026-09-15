// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Test-only stand-in for USDG. Real testnet USDG is confirmed live
/// on X Layer (0xF0863D7A29a55d0c4263c11bFac754312ff078DF) with 6 decimals,
/// NOT 18 -- confirmed directly against the deployed contract. Decimals are
/// configurable here so tests can exercise both the real 6-decimal shape and
/// a simple 18-decimal shape; deploy scripts targeting a real network should
/// prefer the real USDG address over this mock wherever possible.
contract MockUSDG is ERC20, Ownable {
    uint8 private immutable _decimals;

    constructor(address owner_, uint8 decimals_) ERC20("Mock USDG", "USDG-MOCK") Ownable(owner_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
