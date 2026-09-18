// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {HaltController} from "../core/HaltController.sol";
import {IPausableOracle} from "../oracle/IPausableOracle.sol";

/// @notice DEX stand-in -- testnet has no liquidity for the mock pair, so
/// LeverageZap needs somewhere to convert borrowed USDG into collateral
/// atomically. Prices off the same oracle Market trusts, so a leverage loop
/// can never see a different price than the loan beneath it.
///
/// No AMM curve: a priced pool the owner seeds and tops up, not one deriving
/// price from reserves. Halt-gated like Market.supply()/borrow().
contract SwapModule is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant WAD = 1e18;
    /// @notice Matches Market's default -- equities don't need second-by-second
    /// freshness, but a swap shouldn't price off an arbitrarily old feed.
    uint256 private constant MAX_ORACLE_STALENESS = 24 hours;
    /// @notice Ceiling the owner can never exceed, however many signers agree.
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

    /// @notice Swap USDG for wNVDAx at the oracle price, minus fee. The leg
    /// LeverageZap calls, in the same transaction as the borrow.
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
        // price is WAD debt-value per WAD collateral (Market's convention).
        // One multiply-then-divide: the /WAD and *WAD of the two-step form
        // cancel, avoiding a divide-before-multiply rounding loss.
        uint256 collateralWad = (debtWad * (WAD - feeWad)) / price;
        collateralOut = _fromWad(collateralWad, collateralDecimals);
        if (collateralOut == 0) revert ZeroAmount();
        if (collateralOut > collateralToken.balanceOf(address(this))) revert InsufficientInventory();

        debtToken.safeTransferFrom(msg.sender, address(this), debtAmountIn);
        collateralToken.safeTransfer(to, collateralOut);
        emit Swapped(msg.sender, to, false, debtAmountIn, collateralOut);
    }

    /// @notice Inverse of swapDebtForCollateral, for deleverage/unwind flows.
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
        // All multiplications before the single division, as above.
        uint256 debtAfterFeeWad = (collateralWad * price * (WAD - feeWad)) / (WAD * WAD);
        debtOut = _fromWad(debtAfterFeeWad, debtDecimals);
        if (debtOut == 0) revert ZeroAmount();
        if (debtOut > debtToken.balanceOf(address(this))) revert InsufficientInventory();

        collateralToken.safeTransferFrom(msg.sender, address(this), collateralAmountIn);
        debtToken.safeTransfer(to, debtOut);
        emit Swapped(msg.sender, to, true, collateralAmountIn, debtOut);
    }

    /// @dev Independent of HaltController (like Market._requireFreshPrice), so
    /// no future path can price against a frozen or stale feed.
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
