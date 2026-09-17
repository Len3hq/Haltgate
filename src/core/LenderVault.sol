// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Market} from "./Market.sol";

/// @notice ERC-4626 vault: depositors put in USDG, get yield-bearing shares
/// out. This is where lenders' actual cash lives -- Market never custodies
/// debt-token funds itself, only risk logic (collateral, LTV, liquidations).
/// Share price is the ONLY place yield is represented: there's no separate
/// "supply rate" tracked in storage that could drift out of sync with it --
/// totalAssets() reads Market's live interest accrual directly, so the
/// exchange rate is always the ground truth.
///
/// Inflation-attack protection: relies on OpenZeppelin ERC4626's built-in
/// virtual shares/assets (`+1` / `+10**decimalsOffset()` in its conversion
/// math), confirmed in its own docs to make the classic donation attack
/// non-profitable even at the default zero offset -- not something this
/// contract needs to separately defend against.
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

    /// @notice One-time wiring. Market's constructor needs this vault's
    /// address to pull/return cash, so the vault necessarily deploys first
    /// with market unset -- locked after the first call so it can never be
    /// silently repointed at a different risk contract later.
    function setMarket(address market_) external onlyOwner {
        if (address(market) != address(0)) revert MarketAlreadySet();
        if (market_ == address(0)) revert ZeroAddress();
        market = Market(market_);
    }

    /// @notice Cash Market sends to a borrower. Only Market can call this --
    /// it's the only contract that has already checked LTV, halt state, and
    /// available liquidity before asking for funds to move.
    function borrowCash(address to, uint256 amount) external onlyMarket nonReentrant {
        IERC20(asset()).safeTransfer(to, amount);
    }

    /// @notice Value owed to LP shareholders: cash on hand, plus everything
    /// currently out on loan (interest-inclusive, computed live via
    /// Market's pending-accrual view so this is accurate even between
    /// Market's own accrual transactions), minus reserves -- reserves are
    /// the protocol's cut of interest, not depositors'.
    ///
    /// Deliberately computed as ONE left-to-right expression -- cash and
    /// totalBorrows summed first, reserves subtracted from that combined
    /// total last -- not as cash + (totalBorrows - totalReserves). The
    /// combined sum can never fall below totalReserves (reserves are only
    /// ever funded out of interest already folded into totalBorrows, and a
    /// repayment moves value from totalBorrows into cash without changing
    /// their sum), but totalBorrows alone can: a full repayment can
    /// legitimately drop it to zero while totalReserves is still positive.
    /// Subtracting in that isolated order underflowed and reverted every
    /// deposit/withdraw call permanently in exactly that scenario --
    /// confirmed by reproduction before this fix.
    function totalAssets() public view override returns (uint256) {
        (uint256 pendingTotalBorrows, uint256 pendingTotalReserves) = market.pendingBorrowsAndReserves();
        return IERC20(asset()).balanceOf(address(this)) + pendingTotalBorrows - pendingTotalReserves;
    }

    /// @notice Capped at actual liquid cash -- part of totalAssets() is
    /// currently lent out to borrowers and can't be withdrawn until repaid.
    /// Per OZ's own guidance, overriding maxRedeem alone is sufficient:
    /// maxWithdraw's default implementation is previewRedeem(maxRedeem(...)),
    /// which picks up this override automatically through virtual dispatch.
    ///
    /// Also zero whenever the market isn't fully OPEN -- reuses
    /// HaltController.canLiquidate()'s exact condition rather than inventing
    /// a parallel one, since liquidation is literally the mechanism that
    /// resolves the same uncertainty a halt creates. Found in a live audit:
    /// every borrower-side action (borrow, liquidate, new interest) was
    /// correctly frozen during a halt, but withdrawals here were not --
    /// letting LPs exit at a stale, frozen share price ahead of any bad debt
    /// a corporate action might reveal on resume, while depositors slower to
    /// react absorbed a disproportionate share of whatever was left. Deposits
    /// stay unrestricted throughout: adding liquidity only ever helps, the
    /// same reasoning Market.supply()/repay() already rely on for actions
    /// that can't hurt anyone but the caller.
    function maxRedeem(address owner_) public view override returns (uint256) {
        if (!market.haltController().canLiquidate()) return 0;
        uint256 cash = IERC20(asset()).balanceOf(address(this));
        uint256 cashInShares = convertToShares(cash);
        uint256 ownerMax = super.maxRedeem(owner_);
        return ownerMax > cashInShares ? cashInShares : ownerMax;
    }

    /// @dev Nudges Market's interest bookkeeping current on every deposit,
    /// on top of the always-accurate pending-accrual math totalAssets()
    /// already applies regardless -- keeps Market's own on-chain state
    /// (totalBorrows, reserves) from drifting stale for other readers.
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
