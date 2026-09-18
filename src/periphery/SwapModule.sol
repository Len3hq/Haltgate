// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {HaltController} from "../core/HaltController.sol";
import {IPausableOracle} from "../oracle/IPausableOracle.sol";

/// @notice Stand-in for a real DEX: X Layer testnet has no liquidity for the
/// mock wNVDAx/USDG pair, so LeverageZap (BUILD.md §11 Milestone 1) needs
/// somewhere to convert borrowed USDG into more collateral atomically. Prices
/// strictly off the same oracle Market itself trusts -- never an independent
/// read -- so a leverage loop can never see a different price than the one
/// the loan it's built on top of is collateralized against.
///
/// No AMM curve: this is a priced pool that must be seeded and topped up by
/// its owner, same as any market maker, not something that derives its own
/// price from reserves the way a constant-product pool would.
///
/// Gated on HaltController.canSupplyOrBorrow() -- can't swap into more
/// exposure to a stock whose price is currently frozen for a corporate
/// action, the same restriction Market.supply()/borrow() already enforce.
contract SwapModule is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant WAD = 1e18;
    /// @notice Matches Market's own default maxOracleStaleness -- equities
    /// don't need second-by-second freshness, but a swap still shouldn't
    /// price off an arbitrarily old feed.
    uint256 private constant MAX_ORACLE_STALENESS = 24 hours;
    /// @notice Hard ceiling the owner can never exceed, no matter how many
    /// multisig signers agree -- mirrors Market's MAX_RESERVE_FACTOR pattern.
    uint256 public constant MAX_FEE = 0.05e18; // 5%

    IERC20 public immutable collateralToken; // wNVDAx
    IERC20 public immutable debtToken; // USDG
    uint8 public immutable collateralDecimals;
    uint8 public immutable debtDecimals;
    IPausableOracle public immutable oracle;
    HaltController public immutable haltController;

    /// @notice WAD fraction taken from every swap's output.
    uint256 public feeWad;

    event Swapped(address indexed caller, address indexed to, bool collateralForDebt, uint256 amountIn, uint256 amountOut);
    event FeeUpdated(uint256 previous, uint256 next);
    event InventoryWithdrawn(address indexed token, address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error FeeTooHigh();
    error MarketHalted();
    error OraclePausedDirectly();
    error StaleOracle(uint256 lastUpdated, uint256 maxStaleness);
    error InsufficientInventory();

    modifier whenOpen() {
        if (!haltController.canSupplyOrBorrow()) revert MarketHalted();
        _;
    }

    constructor(
        address collateralToken_,
        address debtToken_,
        address oracle_,
        address haltController_,
        uint256 feeWad_,
        address owner_
    ) Ownable(owner_) {
        if (
            collateralToken_ == address(0) || debtToken_ == address(0) || oracle_ == address(0)
                || haltController_ == address(0) || owner_ == address(0)
        ) revert ZeroAddress();
        if (feeWad_ > MAX_FEE) revert FeeTooHigh();

        collateralToken = IERC20(collateralToken_);
        debtToken = IERC20(debtToken_);
        collateralDecimals = IERC20Metadata(collateralToken_).decimals();
        debtDecimals = IERC20Metadata(debtToken_).decimals();
        oracle = IPausableOracle(oracle_);
        haltController = HaltController(haltController_);
        feeWad = feeWad_;
    }

    function setFee(uint256 newFeeWad) external onlyOwner {
        if (newFeeWad > MAX_FEE) revert FeeTooHigh();
        emit FeeUpdated(feeWad, newFeeWad);
        feeWad = newFeeWad;
    }

    /// @notice Owner tops up or reclaims inventory of either token.
    function withdrawInventory(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit InventoryWithdrawn(token, to, amount);
    }

    /// @notice Swap USDG for wNVDAx at the oracle price, minus fee. This is
    /// the leg LeverageZap calls: borrow USDG, convert it into more
    /// collateral, atomically, in the same transaction as the borrow.
    /// @return collateralOut Collateral sent to `to`, in its native decimals.
    function swapDebtForCollateral(uint256 debtAmountIn, address to)
        external
        nonReentrant
        whenOpen
        returns (uint256 collateralOut)
    {
        if (debtAmountIn == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        uint256 price = _requireFreshPrice();

        uint256 debtWad = _toWad(debtAmountIn, debtDecimals);
        // price is WAD debt-value per 1 WAD collateral (same convention as
        // Market._collateralValueWad) -- so collateral = debtValue * WAD / price.
        // Combined into one multiply-then-single-divide instead of computing
        // debtAfterFeeWad (/WAD) and then collateralWad (*WAD/price) as two
        // separate steps -- the /WAD and *WAD cancel algebraically, and doing
        // so avoids rounding the intermediate down before scaling it back up
        // (the divide-before-multiply pattern already fixed twice elsewhere:
        // InterestRateModel.getSupplyRatePerSecond, Market._computeAccrual).
        uint256 collateralWad = (debtWad * (WAD - feeWad)) / price;
        collateralOut = _fromWad(collateralWad, collateralDecimals);
        if (collateralOut == 0) revert ZeroAmount();
        if (collateralOut > collateralToken.balanceOf(address(this))) revert InsufficientInventory();

        debtToken.safeTransferFrom(msg.sender, address(this), debtAmountIn);
        collateralToken.safeTransfer(to, collateralOut);
        emit Swapped(msg.sender, to, false, debtAmountIn, collateralOut);
    }

    /// @notice Swap wNVDAx for USDG at the oracle price, minus fee. Symmetric
    /// counterpart to swapDebtForCollateral, for future deleverage/unwind flows.
    /// @return debtOut USDG sent to `to`, in its native decimals.
    function swapCollateralForDebt(uint256 collateralAmountIn, address to)
        external
        nonReentrant
        whenOpen
        returns (uint256 debtOut)
    {
        if (collateralAmountIn == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        uint256 price = _requireFreshPrice();

        uint256 collateralWad = _toWad(collateralAmountIn, collateralDecimals);
        // All three multiplications before the single final division -- same
        // combined-expression fix as swapDebtForCollateral above.
        uint256 debtAfterFeeWad = (collateralWad * price * (WAD - feeWad)) / (WAD * WAD);
        debtOut = _fromWad(debtAfterFeeWad, debtDecimals);
        if (debtOut == 0) revert ZeroAmount();
        if (debtOut > debtToken.balanceOf(address(this))) revert InsufficientInventory();

        collateralToken.safeTransferFrom(msg.sender, address(this), collateralAmountIn);
        debtToken.safeTransfer(to, debtOut);
        emit Swapped(msg.sender, to, true, collateralAmountIn, debtOut);
    }

    /// @dev Deliberately independent of HaltController's state (like
    /// Market._requireFreshPrice) -- checks the oracle's own paused flag and
    /// staleness directly, so a swap can never execute against a frozen or
    /// stale price even in some future path that doesn't route through
    /// whenOpen's HaltController check.
    function _requireFreshPrice() internal view returns (uint256 price) {
        bool paused;
        uint256 updatedAt;
        (price, updatedAt, paused) = oracle.latestPrice();
        if (paused) revert OraclePausedDirectly();
        if (block.timestamp - updatedAt > MAX_ORACLE_STALENESS) revert StaleOracle(updatedAt, MAX_ORACLE_STALENESS);
    }

    function _toWad(uint256 amount, uint8 decimals) internal pure returns (uint256) {
        if (decimals == 18) return amount;
        return amount * (10 ** (18 - decimals));
    }

    function _fromWad(uint256 amountWad, uint8 decimals) internal pure returns (uint256) {
        if (decimals == 18) return amountWad;
        return amountWad / (10 ** (18 - decimals));
    }
}
