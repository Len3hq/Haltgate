// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Market} from "./Market.sol";
import {HaltController} from "./HaltController.sol";

/// @notice ERC-4626 vault holding lenders' USDG; Market holds only risk logic.
/// Yield lives solely in share price -- no stored supply rate that could drift.
/// Inflation attacks are covered by OZ ERC4626's built-in virtual shares.
contract LenderVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    Market public market;

    error ZeroAddress();
    error MarketAlreadySet();
    error OnlyMarket();

    modifier onlyMarket() {
        if (msg.sender != address(market)) revert OnlyMarket();
        _;
    }

    constructor(address asset_, address owner_)
        ERC20("HaltGate USDG Vault", "hgUSDG")
        ERC4626(IERC20(asset_))
        Ownable(owner_)
    {
        if (asset_ == address(0) || owner_ == address(0)) revert ZeroAddress();
    }

    /// @notice One-time wiring -- the vault must deploy before Market, and is
    /// locked afterwards so it can't be repointed at another risk contract.
    function setMarket(address market_) external onlyOwner {
        if (address(market) != address(0)) revert MarketAlreadySet();
        if (market_ == address(0)) revert ZeroAddress();
        market = Market(market_);
    }

    /// @notice Market-only: it's the one contract that has already checked LTV,
    /// halt state and liquidity before asking for funds to move.
    function borrowCash(address to, uint256 amount) external onlyMarket nonReentrant {
        IERC20(asset()).safeTransfer(to, amount);
    }

    /// @notice Cash + outstanding variable loans (interest-inclusive) + fixed-term
    /// principal - reserves.
    /// @dev Fixed-term interest is deliberately excluded until it is actually
    /// repaid, so the vault never marks up yield it hasn't earned. A default
    /// therefore shows up here as the principal disappearing, which is exactly
    /// what it is, until governance converts the seized collateral back.
    /// @dev Summed left-to-right on purpose: totalBorrows alone can fall below
    /// totalReserves after a full repayment, and subtracting them in isolation
    /// underflowed and permanently bricked every deposit/withdraw.
    function totalAssets() public view override returns (uint256) {
        (uint256 pendingTotalBorrows, uint256 pendingTotalReserves) = market.pendingBorrowsAndReserves();
        return IERC20(asset()).balanceOf(address(this)) + pendingTotalBorrows + market.totalFixedPrincipal()
            - pendingTotalReserves;
    }

    /// @notice OPEN: capped at liquid cash. Halted: zero -- otherwise LPs could
    /// exit at a stale share price ahead of bad debt a corporate action may
    /// reveal. SETTLING: capped pro-rata (see below). Deposits stay open
    /// throughout; adding liquidity can't hurt anyone.
    /// @dev Overriding maxRedeem alone is enough -- maxWithdraw defaults to
    /// previewRedeem(maxRedeem(...)) and picks this up via virtual dispatch.
    function maxRedeem(address owner_) public view override returns (uint256) {
        HaltController controller = market.haltController();
        uint256 ownerMax = super.maxRedeem(owner_); // OZ: the owner's full share balance
        uint256 cash = IERC20(asset()).balanceOf(address(this));

        if (controller.canLiquidate()) {
            uint256 cashInShares = convertToShares(cash);
            return ownerMax > cashInShares ? cashInShares : ownerMax;
        }

        // Pro-rata, never first-come-first-served: everyone draws the same
        // proportion at the same price, so cash and supply fall in step and
        // the share price is untouched. Being early buys no better rate, which
        // is what stops settlement reintroducing the run the freeze prevents.
        if (controller.isSettling()) {
            uint256 supply = totalSupply();
            if (supply == 0) return 0;
            uint256 entitlementShares = convertToShares((cash * ownerMax) / supply);
            return ownerMax > entitlementShares ? entitlementShares : ownerMax;
        }

        return 0;
    }

    /// @dev totalAssets() is already accurate without this; accruing here just
    /// keeps Market's stored state fresh for other readers.
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override nonReentrant {
        market.accrueInterest();
        super._deposit(caller, receiver, assets, shares);
    }

    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        market.accrueInterest();
        super._withdraw(caller, receiver, owner_, assets, shares);
    }
}
