// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {HaltController} from "./HaltController.sol";
import {IPausableOracle} from "../oracle/IPausableOracle.sol";

/// @notice Single isolated market: deposit collateral (wNVDAx), borrow USDG,
/// repay -- gated end to end by HaltController so a corporate-action price
/// discontinuity can never be borrowed or liquidated against. One fixed LTV
/// and liquidation threshold for the hackathon demo; per-tier RiskModule
/// config is roadmap, not v1 (see BUILD.md §4).
///
/// Decimals: positions are stored in each token's own native decimals (what
/// gets transferred), but every value comparison (LTV, liquidation threshold,
/// solvency) is normalized to an 18-decimal WAD internally before comparing.
/// This matters concretely: real testnet USDG uses 6 decimals, not 18 --
/// confirmed directly against the live contract -- so treating collateral
/// and debt amounts as interchangeable without normalizing would have been
/// silently wrong by a factor of 10^12 the moment real USDG was wired in.
contract Market is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Position {
        uint256 collateral; // collateralToken's native decimals
        uint256 debt; // debtToken's native decimals
    }

    uint256 private constant WAD = 1e18;

    IERC20 public immutable collateralToken;
    IERC20 public immutable debtToken;
    IPausableOracle public immutable oracle;
    HaltController public immutable haltController;
    uint8 public immutable collateralDecimals;
    uint8 public immutable debtDecimals;

    /// @notice 18-decimal fixed point, e.g. 0.5e18 = 50%.
    uint256 public maxLTV;
    uint256 public liquidationThreshold;
    /// @notice Discount a liquidator receives on seized collateral, 18-decimal fixed point.
    uint256 public liquidationBonus;
    /// @notice Max fraction of a position's debt repayable in one liquidation call.
    uint256 public constant CLOSE_FACTOR = 0.5e18;
    /// @notice Max age (seconds) of the oracle's last update before borrow/
    /// liquidate refuse to trust it -- independent of HaltController's state,
    /// since that only updates when someone calls its permissionless sync().
    /// If nobody calls sync() promptly after a real corporate-action pause,
    /// HaltController could still report OPEN while the oracle itself is
    /// paused or simply stale; this is Market's own defense-in-depth check.
    uint256 public maxOracleStaleness;

    mapping(address => Position) public positions;
    uint256 public totalCollateral;
    uint256 public totalDebt;

    event Supplied(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator, uint256 debtRepaid, uint256 collateralSeized);
    event RiskParamsUpdated(uint256 maxLTV, uint256 liquidationThreshold);
    event LiquidationBonusUpdated(uint256 newBonus);
    event MaxOracleStalenessUpdated(uint256 newMaxStaleness);

    error MarketHalted();
    error ExceedsMaxLTV();
    error InsufficientCollateral();
    error ZeroAmount();
    error InvalidRiskParams();
    error NotLiquidatable();
    error UnsupportedDecimals();
    error OraclePausedDirectly();
    error StaleOracle(uint256 lastUpdated, uint256 maxStaleness);

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
        if (liquidationThreshold_ <= maxLTV_ || liquidationThreshold_ > WAD) revert InvalidRiskParams();

        uint8 collDec = IERC20Metadata(collateralToken_).decimals();
        uint8 debtDec = IERC20Metadata(debtToken_).decimals();
        if (collDec > 18 || debtDec > 18) revert UnsupportedDecimals();

        collateralToken = IERC20(collateralToken_);
        debtToken = IERC20(debtToken_);
        oracle = IPausableOracle(oracle_);
        haltController = HaltController(haltController_);
        collateralDecimals = collDec;
        debtDecimals = debtDec;
        maxLTV = maxLTV_;
        liquidationThreshold = liquidationThreshold_;
        liquidationBonus = 0.05e18; // 5% default
        maxOracleStaleness = 24 hours; // default -- equities don't need second-by-second freshness, but shouldn't be arbitrarily old either
    }

    function setRiskParams(uint256 newMaxLTV, uint256 newLiquidationThreshold) external onlyOwner {
        if (newLiquidationThreshold <= newMaxLTV || newLiquidationThreshold > WAD) revert InvalidRiskParams();
        maxLTV = newMaxLTV;
        liquidationThreshold = newLiquidationThreshold;
        emit RiskParamsUpdated(newMaxLTV, newLiquidationThreshold);
    }

    function setLiquidationBonus(uint256 newBonus) external onlyOwner {
        liquidationBonus = newBonus;
        emit LiquidationBonusUpdated(newBonus);
    }

    function setMaxOracleStaleness(uint256 newMaxStaleness) external onlyOwner {
        maxOracleStaleness = newMaxStaleness;
        emit MaxOracleStalenessUpdated(newMaxStaleness);
    }

    /// @notice Seeds market liquidity for the demo. Standing in for a
    /// full ERC-4626 LenderVault, which is out of v1 scope (BUILD.md §4).
    function fundMarket(uint256 amount) external onlyOwner nonReentrant {
        debtToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function supply(uint256 amount) external nonReentrant whenSupplyOrBorrowAllowed {
        if (amount == 0) revert ZeroAmount();
        positions[msg.sender].collateral += amount;
        totalCollateral += amount;
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Supplied(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant whenSupplyOrBorrowAllowed {
        if (amount == 0) revert ZeroAmount();
        _requireFreshPrice();
        Position storage pos = positions[msg.sender];
        pos.debt += amount;

        if (pos.debt > _maxBorrowableNative(pos.collateral)) revert ExceedsMaxLTV();

        totalDebt += amount;
        debtToken.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    /// @notice Always allowed, even mid-halt -- repay only ever reduces risk.
    function repay(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Position storage pos = positions[msg.sender];
        uint256 repayAmount = amount > pos.debt ? pos.debt : amount;
        if (repayAmount == 0) revert ZeroAmount();

        pos.debt -= repayAmount;
        totalDebt -= repayAmount;
        debtToken.safeTransferFrom(msg.sender, address(this), repayAmount);
        emit Repaid(msg.sender, repayAmount);
    }

    /// @notice Repays up to CLOSE_FACTOR of an undercollateralized position's
    /// debt in exchange for seized collateral at a discount. Reverts while
    /// halted or resuming -- BUILD.md §5: "liquidations wait until fully
    /// OPEN, even during RESUMING," since a just-resumed price/solvency
    /// state is exactly when liquidating is most dangerous.
    function liquidate(address user, uint256 repayAmount) external nonReentrant {
        if (!haltController.canLiquidate()) revert MarketHalted();
        // Checked before isLiquidatable() so a stale/paused oracle always
        // surfaces as StaleOracle/OraclePausedDirectly, not a possibly-
        // misleading NotLiquidatable computed from frozen data.
        uint256 price = _requireFreshPrice();
        if (!isLiquidatable(user)) revert NotLiquidatable();

        Position storage pos = positions[user];
        uint256 maxRepay = (pos.debt * CLOSE_FACTOR) / WAD;
        uint256 actualRepay = repayAmount > maxRepay ? maxRepay : repayAmount;
        if (actualRepay == 0) revert ZeroAmount();

        uint256 actualRepayWad = _toWad(actualRepay, debtDecimals);
        // Multiply before divide to avoid precision loss.
        uint256 collateralSeizedWad = (actualRepayWad * (WAD + liquidationBonus)) / price;
        uint256 collateralSeized = _fromWad(collateralSeizedWad, collateralDecimals);
        if (collateralSeized > pos.collateral) collateralSeized = pos.collateral;

        pos.debt -= actualRepay;
        pos.collateral -= collateralSeized;
        totalDebt -= actualRepay;
        totalCollateral -= collateralSeized;

        debtToken.safeTransferFrom(msg.sender, address(this), actualRepay);
        collateralToken.safeTransfer(msg.sender, collateralSeized);
        emit Liquidated(user, msg.sender, actualRepay, collateralSeized);
    }

    /// @return 18-decimal fixed point; type(uint256).max if the position has no debt.
    function healthFactor(address user) external view returns (uint256) {
        Position memory pos = positions[user];
        if (pos.debt == 0) return type(uint256).max;
        uint256 maxBorrowAtLiqThresholdWad = (_collateralValueWad(pos.collateral) * liquidationThreshold) / WAD;
        uint256 debtWad = _toWad(pos.debt, debtDecimals);
        return (maxBorrowAtLiqThresholdWad * WAD) / debtWad;
    }

    function isLiquidatable(address user) public view returns (bool) {
        Position memory pos = positions[user];
        if (pos.debt == 0) return false;
        uint256 maxBorrowAtLiqThresholdWad = (_collateralValueWad(pos.collateral) * liquidationThreshold) / WAD;
        uint256 debtWad = _toWad(pos.debt, debtDecimals);
        return debtWad > maxBorrowAtLiqThresholdWad;
    }

    /// @notice True once total collateral value covers total debt -- what a
    /// keeper checks before calling HaltController.completeResume() post-CA.
    function isSystemSolvent() external view returns (bool) {
        return _collateralValueWad(totalCollateral) >= _toWad(totalDebt, debtDecimals);
    }

    /// @return Max borrowable debt, in debtToken's native decimals.
    function _maxBorrowableNative(uint256 collateralAmountNative) internal view returns (uint256) {
        uint256 maxBorrowWad = (_collateralValueWad(collateralAmountNative) * maxLTV) / WAD;
        return _fromWad(maxBorrowWad, debtDecimals);
    }

    /// @notice Independent freshness gate for borrow()/liquidate() -- does
    /// NOT rely on HaltController's state, only on the oracle's own reported
    /// paused flag and updatedAt timestamp. Deliberately not used by the
    /// view functions (healthFactor, isSystemSolvent) so off-chain monitoring
    /// or UI polling doesn't start reverting just because the oracle happens
    /// to be paused at that moment.
    function _requireFreshPrice() internal view returns (uint256 price) {
        bool paused;
        uint256 updatedAt;
        (price, updatedAt, paused) = oracle.latestPrice();
        if (paused) revert OraclePausedDirectly();
        if (block.timestamp - updatedAt > maxOracleStaleness) revert StaleOracle(updatedAt, maxOracleStaleness);
    }

    /// @notice Oracle price is always an 18-decimal ratio -- "WAD debt-value
    /// per 1 WAD unit of collateral" -- independent of either token's own
    /// on-chain decimals. Only the collateral amount fed in needs normalizing.
    /// @return Collateral value in WAD (18-decimal), debt-equivalent terms.
    function _collateralValueWad(uint256 collateralAmountNative) internal view returns (uint256) {
        (uint256 price,,) = oracle.latestPrice();
        uint256 collateralWad = _toWad(collateralAmountNative, collateralDecimals);
        return (collateralWad * price) / WAD;
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
