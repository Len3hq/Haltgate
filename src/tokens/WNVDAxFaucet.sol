// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Self-serve testnet faucet for wNVDAx. MockWrappedXStock.mint() is
/// deliberately onlyOwner -- mirroring how a real collateral token would
/// never let anyone mint it -- which meant every new tester had to ask the
/// deployer to mint to them by hand. This holds a stockpile (funded once by
/// the token's owner, same onlyOwner mint) and lets anyone claim a fixed
/// amount permissionlessly instead, without touching the token's own access
/// control or requiring a Market/vault redeploy (both hold wNVDAx's address
/// immutably, so the token contract itself can't change).
contract WNVDAxFaucet {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint256 public constant CLAIM_AMOUNT = 10e18;

    mapping(address => bool) public hasClaimed;

    event Claimed(address indexed to, uint256 amount);

    error AlreadyClaimed();

    constructor(address token_) {
        token = IERC20(token_);
    }

    /// @notice One claim per address -- not a security boundary (this is
    /// free testnet collateral with no real value), just a guard against one
    /// tester trivially script-draining the whole stockpile and griefing
    /// everyone else testing after them.
    function claim() external {
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();
        hasClaimed[msg.sender] = true;
        token.safeTransfer(msg.sender, CLAIM_AMOUNT);
        emit Claimed(msg.sender, CLAIM_AMOUNT);
    }
}
