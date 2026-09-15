// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HaltController} from "./HaltController.sol";
import {IPausableOracle} from "../oracle/IPausableOracle.sol";

/// @notice Single isolated market: deposit collateral (wNVDAx), borrow USDG,
/// repay -- gated end to end by HaltController so a corporate-action price
/// discontinuity can never be borrowed or liquidated against. One fixed LTV
/// and liquidation threshold for the hackathon demo; per-tier RiskModule
/// config is roadmap, not v1 (see BUILD.md §4).
contract Market is Ownable {
    using SafeERC20 for IERC20;

    struct Position {
        uint256 collateral;
        uint256 debt;
    }

    IERC20 public immutable collateralToken;
    IERC20 public immutable debtToken;
    IPausableOracle public immutable oracle;
    HaltController public immutable haltController;

    /// @notice 18-decimal fixed point, e.g. 0.5e18 = 50%.
    uint256 public maxLTV;
    uint256 public liquidationThreshold;

    mapping(address => Position) public positions;
    uint256 public totalCollateral;
    uint256 public totalDebt;

    event Supplied(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event RiskParamsUpdated(uint256 maxLTV, uint256 liquidationThreshold);

    error MarketHalted();
    error ExceedsMaxLTV();
    error InsufficientCollateral();
    error ZeroAmount();
    error InvalidRiskParams();

    modifier whenSupplyOrBorrowAllowed() {
        if (!haltController.canSupplyOrBorrow()) revert MarketHalted();
        _;
    }

    constructor(
        address collateralToken_,
        address debtToken_,
        address oracle_,
        address haltController_,
        address owner_,
        uint256 maxLTV_,
        uint256 liquidationThreshold_
    ) Ownable(owner_) {
        if (liquidationThreshold_ <= maxLTV_ || liquidationThreshold_ > 1e18) revert InvalidRiskParams();
        collateralToken = IERC20(collateralToken_);
        debtToken = IERC20(debtToken_);
        oracle = IPausableOracle(oracle_);
        haltController = HaltController(haltController_);
        maxLTV = maxLTV_;
        liquidationThreshold = liquidationThreshold_;
    }

    function setRiskParams(uint256 newMaxLTV, uint256 newLiquidationThreshold) external onlyOwner {
        if (newLiquidationThreshold <= newMaxLTV || newLiquidationThreshold > 1e18) revert InvalidRiskParams();
        maxLTV = newMaxLTV;
        liquidationThreshold = newLiquidationThreshold;
        emit RiskParamsUpdated(newMaxLTV, newLiquidationThreshold);
    }

    /// @notice Seeds market liquidity for the demo. Standing in for a
    /// full ERC-4626 LenderVault, which is out of v1 scope (BUILD.md §4).
    function fundMarket(uint256 amount) external onlyOwner {
        debtToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function supply(uint256 amount) external whenSupplyOrBorrowAllowed {
        if (amount == 0) revert ZeroAmount();
        positions[msg.sender].collateral += amount;
        totalCollateral += amount;
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Supplied(msg.sender, amount);
    }

    function borrow(uint256 amount) external whenSupplyOrBorrowAllowed {
        if (amount == 0) revert ZeroAmount();
        Position storage pos = positions[msg.sender];
        pos.debt += amount;

        if (pos.debt > _maxBorrowable(pos.collateral)) revert ExceedsMaxLTV();

        totalDebt += amount;
        debtToken.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    /// @notice Always allowed, even mid-halt -- repay only ever reduces risk.
    function repay(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Position storage pos = positions[msg.sender];
        uint256 repayAmount = amount > pos.debt ? pos.debt : amount;
        if (repayAmount == 0) revert ZeroAmount();

        pos.debt -= repayAmount;
        totalDebt -= repayAmount;
        debtToken.safeTransferFrom(msg.sender, address(this), repayAmount);
        emit Repaid(msg.sender, repayAmount);
    }

    function healthFactor(address user) external view returns (uint256) {
        Position memory pos = positions[user];
        if (pos.debt == 0) return type(uint256).max;
        uint256 maxBorrowAtLiqThreshold = (_collateralValue(pos.collateral) * liquidationThreshold) / 1e18;
        return (maxBorrowAtLiqThreshold * 1e18) / pos.debt;
    }

    function isLiquidatable(address user) public view returns (bool) {
        Position memory pos = positions[user];
        if (pos.debt == 0) return false;
        uint256 maxBorrowAtLiqThreshold = (_collateralValue(pos.collateral) * liquidationThreshold) / 1e18;
        return pos.debt > maxBorrowAtLiqThreshold;
    }

    /// @notice True once total collateral value covers total debt -- what a
    /// keeper checks before calling HaltController.completeResume() post-CA.
    function isSystemSolvent() external view returns (bool) {
        return _collateralValue(totalCollateral) >= totalDebt;
    }

    function _maxBorrowable(uint256 collateralAmount) internal view returns (uint256) {
        return (_collateralValue(collateralAmount) * maxLTV) / 1e18;
    }

    function _collateralValue(uint256 collateralAmount) internal view returns (uint256) {
        (uint256 price,,) = oracle.latestPrice();
        return (collateralAmount * price) / 1e18;
    }
}
