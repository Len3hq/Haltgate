// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Test-only stand-in for USDG. Real testnet USDG is confirmed
/// available on X Layer via faucet.paxos.com -- this mock exists purely for
/// fast, deterministic local/CI testing; swap in the real testnet address
/// for the actual demo deployment. 18 decimals for simplicity; confirm
/// real USDG's decimals before any mainnet-facing integration.
contract MockUSDG is ERC20, Ownable {
    constructor(address owner_) ERC20("Mock USDG", "USDG-MOCK") Ownable(owner_) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
