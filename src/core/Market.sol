// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {HaltController} from "./HaltController.sol";
import {InterestRateModel} from "./InterestRateModel.sol";
import {LenderVault} from "./LenderVault.sol";
import {IPausableOracle} from "../oracle/IPausableOracle.sol";

/// @notice Single isolated market: deposit collateral (wNVDAx), borrow USDG
/// out of LenderVault, repay with interest -- gated end to end by
/// HaltController so a corporate-action price discontinuity can never be
/// borrowed or liquidated against. One fixed LTV and liquidation threshold
/// for the hackathon demo; per-tier RiskModule config is roadmap, not v1
/// (see BUILD.md §4).
///
/// Decimals: positions are stored in each token's own native decimals (what
/// gets transferred), but every value comparison (LTV, liquidation threshold,
/// solvency) is normalized to an 18-decimal WAD internally before comparing.
/// This matters concretely: real testnet USDG uses 6 decimals, not 18 --
/// confirmed directly against the live contract -- so treating collateral
/// and debt amounts as interchangeable without normalizing would have been
/// silently wrong by a factor of 10^12 the moment real USDG was wired in.
///
/// Interest: a Compound-v2-style borrow index. `borrowIndex` starts at 1e18
/// and only ever grows; every position stores its own principal plus the
/// index value at its last touch, so per-user debt is recovered lazily as
/// `principal * borrowIndex / snapshotIndex` without ever having to iterate
/// positions. accrueInterest() is permissionless and called at the top of
/// every state-changing function here, so on-chain state is always current
/// at the moment anything reads it. View functions (healthFactor,
/// isLiquidatable, currentDebt) additionally compute what accrual WOULD
/// produce right now without writing anything, so they're accurate even
/// between transactions -- critical, since understating a live debt in a
/// health check would be a real safety bug, not a display quirk.
contract Market is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Position {
        uint256 collateral; // collateralToken's native decimals
        uint256 principal; // debtToken's native decimals, as of borrowIndexSnapshot
        uint256 borrowIndexSnapshot; // WAD, borrowIndex value at last touch
    }

    uint256 private constant WAD = 1e18;
    /// @notice Hard ceiling on reserveFactor -- governance can tune it, but
    /// can never drive lender yield to zero even in a misconfiguration.
    uint256 private constant MAX_RESERVE_FACTOR = 0.5e18;

    IERC20 public immutable collateralToken;
    IERC20 public immutable debtToken;
    IPausableOracle public immutable oracle;
    HaltController public immutable haltController;
    LenderVault public immutable lenderVault;
    uint8 public immutable collateralDecimals;
    uint8 public immutable debtDecimals;

    InterestRateModel public interestRateModel;

    /// @notice 18-decimal fixed point, e.g. 0.5e18 = 50%.
    uint256 public maxLTV;
    uint256 public liquidationThreshold;
    /// @notice Discount a liquidator receives on seized collateral, 18-decimal fixed point.
    uint256 public liquidationBonus;
    /// @notice Fraction of accrued interest kept as protocol reserves rather than paid to lenders, WAD.
    uint256 public reserveFactor;
    /// @notice Max fraction of a position's debt repayable in one liquidation call.
    uint256 public constant CLOSE_FACTOR = 0.5e18;
    /// @notice Max age (seconds) of the oracle's last update before borrow/
    /// liquidate refuse to trust it -- independent of HaltController's state,
    /// since that only updates when someone calls its permissionless sync().
    /// If nobody calls sync() promptly after a real corporate-action pause,
    /// HaltController could still report OPEN while the oracle itself is
    /// paused or simply stale; this is Market's own defense-in-depth check.
    uint256 public maxOracleStaleness;

    /// @notice WAD, grows monotonically as interest accrues. Never resets.
    uint256 public borrowIndex = WAD;
    uint256 public totalBorrows;
    uint256 public totalReserves;
    uint256 public lastAccrualTimestamp;

    mapping(address => Position) public positions;
    uint256 public totalCollateral;

    event Supplied(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator, uint256 debtRepaid, uint256 collateralSeized);
    event RiskParamsUpdated(uint256 maxLTV, uint256 liquidationThreshold);
    event LiquidationBonusUpdated(uint256 newBonus);
    event MaxOracleStalenessUpdated(uint256 newMaxStaleness);
    event InterestRateModelUpdated(address indexed newModel);
    event ReserveFactorUpdated(uint256 newReserveFactor);
    event ReservesWithdrawn(address indexed to, uint256 amount);
    event InterestAccrued(uint256 interestAccumulated, uint256 reservesAdded, uint256 borrowIndex, uint256 totalBorrows);

    error MarketHalted();
    error ExceedsMaxLTV();
    error InsufficientCollateral();
    error InsufficientLiquidity();
    error InsufficientReserves();
    error ZeroAmount();
    error ZeroAddress();
    error InvalidRiskParams();
    error InvalidReserveFactor();
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
        address lenderVault_,
        address interestRateModel_,
        address owner_,
        uint256 maxLTV_,
        uint256 liquidationThreshold_,
        uint256 reserveFactor_
    ) Ownable(owner_) {
        if (liquidationThreshold_ <= maxLTV_ || liquidationThreshold_ > WAD) revert InvalidRiskParams();
        if (lenderVault_ == address(0) || interestRateModel_ == address(0)) revert ZeroAddress();
        if (reserveFactor_ > MAX_RESERVE_FACTOR) revert InvalidReserveFactor();

        uint8 collDec = IERC20Metadata(collateralToken_).decimals();
        uint8 debtDec = IERC20Metadata(debtToken_).decimals();
        if (collDec > 18 || debtDec > 18) revert UnsupportedDecimals();

        collateralToken = IERC20(collateralToken_);
        debtToken = IERC20(debtToken_);
        oracle = IPausableOracle(oracle_);
        haltController = HaltController(haltController_);
        lenderVault = LenderVault(lenderVault_);
        interestRateModel = InterestRateModel(interestRateModel_);
        collateralDecimals = collDec;
        debtDecimals = debtDec;
        maxLTV = maxLTV_;
        liquidationThreshold = liquidationThreshold_;
        reserveFactor = reserveFactor_;
        liquidationBonus = 0.05e18; // 5% default
        maxOracleStaleness = 24 hours; // default -- equities don't need second-by-second freshness, but shouldn't be arbitrarily old either
        lastAccrualTimestamp = block.timestamp;
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

    /// @notice Swappable per BUILD.md's roadmap note on risk config -- lets
    /// governance retune the rate curve, or replace it entirely, without a
    /// full Market redeploy.
    function setInterestRateModel(address newModel) external onlyOwner {
        if (newModel == address(0)) revert ZeroAddress();
        accrueInterest(); // settle interest under the OLD model before switching curves
        interestRateModel = InterestRateModel(newModel);
        emit InterestRateModelUpdated(newModel);
    }

    function setReserveFactor(uint256 newReserveFactor) external onlyOwner {
        if (newReserveFactor > MAX_RESERVE_FACTOR) revert InvalidReserveFactor();
        accrueInterest(); // settle interest under the OLD factor before switching
        reserveFactor = newReserveFactor;
        emit ReserveFactorUpdated(newReserveFactor);
    }

    /// @notice Sends accrued protocol reserves out. Reserves are bookkeeping
    /// on top of totalBorrows, not a separate cash pile -- withdrawing them
    /// is still bounded by the vault's actual liquid cash, same as any
    /// other draw against outstanding borrows.
    function withdrawReserves(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        accrueInterest();
        if (amount > totalReserves) revert InsufficientReserves();
        if (amount > debtToken.balanceOf(address(lenderVault))) revert InsufficientLiquidity();
        totalReserves -= amount;
        lenderVault.borrowCash(to, amount);
        emit ReservesWithdrawn(to, amount);
    }

    function supply(uint256 amount) external nonReentrant whenSupplyOrBorrowAllowed {
        if (amount == 0) revert ZeroAmount();
        positions[msg.sender].collateral += amount;
        totalCollateral += amount;
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Supplied(msg.sender, amount);
    }

    /// @notice Withdraw supplied collateral. If the position carries no debt,
    /// this is always allowed, even mid-halt -- there's no loan to protect,
    /// so it carries the same "only ever reduces risk" reasoning as repay().
    /// If the position has debt, withdrawing raises risk (less collateral
    /// backing the same loan), so it's gated exactly like borrow(): market
    /// must be open, oracle must be fresh, and the position must stay within
    /// maxLTV afterward -- using the freshly-accrued debt, not a stale figure.
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Position storage pos = positions[msg.sender];
        if (amount > pos.collateral) revert InsufficientCollateral();
        uint256 newCollateral = pos.collateral - amount;

        accrueInterest();
        uint256 syncedDebt = _syncUserDebt(msg.sender);
        if (syncedDebt > 0) {
            if (!haltController.canSupplyOrBorrow()) revert MarketHalted();
            _requireFreshPrice();
            if (syncedDebt > _maxBorrowableNative(newCollateral)) revert ExceedsMaxLTV();
        }

        pos.collateral = newCollateral;
        totalCollateral -= amount;
        collateralToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant whenSupplyOrBorrowAllowed {
        if (amount == 0) revert ZeroAmount();
        accrueInterest();
        _requireFreshPrice();

        uint256 availableCash = debtToken.balanceOf(address(lenderVault));
        if (amount > availableCash) revert InsufficientLiquidity();

        Position storage pos = positions[msg.sender];
        uint256 syncedDebt = _syncUserDebt(msg.sender);
        uint256 newDebt = syncedDebt + amount;
        if (newDebt > _maxBorrowableNative(pos.collateral)) revert ExceedsMaxLTV();

        pos.principal = newDebt;
        totalBorrows += amount;
        lenderVault.borrowCash(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    /// @notice Always allowed, even mid-halt -- repay only ever reduces risk.
    function repay(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        accrueInterest();
        Position storage pos = positions[msg.sender];
        uint256 syncedDebt = _syncUserDebt(msg.sender);
        uint256 repayAmount = amount > syncedDebt ? syncedDebt : amount;
        if (repayAmount == 0) revert ZeroAmount();

        pos.principal = syncedDebt - repayAmount;
        // Defensive clamp, matching the collateralSeized clamp in liquidate()
        // below: totalBorrows is the SUM of every position's live debt, each
        // independently floor-rounded off the shared borrowIndex, so it can
        // drift from any one position's own rounded figure by a wei or two
        // over many accrual ticks. repayAmount is already capped at this
        // position's own debt, not at totalBorrows -- without this clamp, an
        // unlucky rounding edge on the last position closing out could
        // underflow totalBorrows and revert a legitimate repayment.
        totalBorrows -= repayAmount > totalBorrows ? totalBorrows : repayAmount;
        // Repayments go straight back into the vault -- Market never
        // custodies debt-token cash itself, even momentarily.
        debtToken.safeTransferFrom(msg.sender, address(lenderVault), repayAmount);
        emit Repaid(msg.sender, repayAmount);
    }

    /// @notice Repays up to CLOSE_FACTOR of an undercollateralized position's
    /// debt in exchange for seized collateral at a discount. Reverts while
    /// halted or resuming -- BUILD.md §5: "liquidations wait until fully
    /// OPEN, even during RESUMING," since a just-resumed price/solvency
    /// state is exactly when liquidating is most dangerous.
    function liquidate(address user, uint256 repayAmount) external nonReentrant {
        if (!haltController.canLiquidate()) revert MarketHalted();
        accrueInterest();
        // Checked before isLiquidatable() so a stale/paused oracle always
        // surfaces as StaleOracle/OraclePausedDirectly, not a possibly-
        // misleading NotLiquidatable computed from frozen data.
        uint256 price = _requireFreshPrice();
        Position storage pos = positions[user];
        uint256 syncedDebt = _syncUserDebt(user);
        if (!isLiquidatable(user)) revert NotLiquidatable();

        uint256 maxRepay = (syncedDebt * CLOSE_FACTOR) / WAD;
        uint256 actualRepay = repayAmount > maxRepay ? maxRepay : repayAmount;
        if (actualRepay == 0) revert ZeroAmount();

        uint256 actualRepayWad = _toWad(actualRepay, debtDecimals);
        // Multiply before divide to avoid precision loss.
        uint256 collateralSeizedWad = (actualRepayWad * (WAD + liquidationBonus)) / price;
        uint256 collateralSeized = _fromWad(collateralSeizedWad, collateralDecimals);
        if (collateralSeized > pos.collateral) collateralSeized = pos.collateral;

        pos.principal = syncedDebt - actualRepay;
        pos.collateral -= collateralSeized;
        // Same defensive clamp as repay() -- see the comment there.
        totalBorrows -= actualRepay > totalBorrows ? totalBorrows : actualRepay;
        totalCollateral -= collateralSeized;

        debtToken.safeTransferFrom(msg.sender, address(lenderVault), actualRepay);
        collateralToken.safeTransfer(msg.sender, collateralSeized);
        emit Liquidated(user, msg.sender, actualRepay, collateralSeized);
    }

    /// @notice Permissionless. Settles global interest up to the current
    /// block: advances borrowIndex, adds interest to totalBorrows, and
    /// splits reserveFactor's share into totalReserves. A no-op (besides
    /// bumping the timestamp) when nothing is owed, so a long idle period
    /// with zero outstanding borrows never applies phantom interest once
    /// someone finally does borrow.
    ///
    /// BUILD.md §6 edge case 5: the interest index is frozen while the
    /// market is HALTED -- disclosed here, not silent. Borrowers can't take
    /// any risk-managing action besides repay during a halt (no new borrow,
    /// no new collateral), and the price itself is frozen too, so charging
    /// interest against a window nobody can react to would be unearned
    /// distortion, not real economics. Only the letter of the edge case
    /// (HALTED specifically) freezes it -- HALTING and RESUMING still accrue,
    /// since those are brief transitional states, not the CA window itself.
    /// This is an approximation at the boundary: because HaltController has
    /// no reference back to Market, accrual can't be split precisely at the
    /// exact block a halt begins or ends -- it freezes (or resumes) as of
    /// whichever state is current the next time accrueInterest() runs, which
    /// in practice is prompt since every state-changing Market call (and
    /// LenderVault deposit/withdraw) triggers it.
    function accrueInterest() public {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return;
        lastAccrualTimestamp = block.timestamp;
        if (totalBorrows == 0) return;
        if (haltController.state() == HaltController.MarketState.HALTED) return;

        uint256 cash = debtToken.balanceOf(address(lenderVault));
        uint256 ratePerSecond = interestRateModel.getBorrowRatePerSecond(cash, totalBorrows);
        (uint256 newIndex, uint256 newTotalBorrows, uint256 interestAccumulated, uint256 reservesAdded) =
            _computeAccrual(borrowIndex, totalBorrows, ratePerSecond, elapsed);

        borrowIndex = newIndex;
        totalBorrows = newTotalBorrows;
        totalReserves += reservesAdded;
        emit InterestAccrued(interestAccumulated, reservesAdded, newIndex, newTotalBorrows);
    }

    /// @notice Pending (accrual-inclusive) totalBorrows and totalReserves,
    /// exposed together -- NOT pre-subtracted -- so LenderVault.totalAssets()
    /// can compute cash + totalBorrows - totalReserves as one left-to-right
    /// expression, summing cash and totalBorrows before subtracting reserves.
    /// Subtracting reserves from totalBorrows in isolation first (an earlier
    /// version of this function did exactly that, returning just the
    /// difference) can underflow: a full repayment legitimately drops
    /// totalBorrows to zero while totalReserves -- funded by interest
    /// already collected, now sitting in the vault's cash balance instead --
    /// is still positive. Confirmed by reproduction: one borrower fully
    /// repaying after a year of accrued interest reverted every subsequent
    /// vault deposit/withdraw with an arithmetic underflow, permanently,
    /// since totalAssets() is on the path of every ERC-4626 entry point.
    /// cash + totalBorrows can never fall below totalReserves, even though
    /// totalBorrows alone can -- see the invariant argument in LenderVault.
    function pendingBorrowsAndReserves() external view returns (uint256 pendingTotalBorrows, uint256 pendingTotalReserves) {
        (, pendingTotalBorrows, pendingTotalReserves) = _pendingAccrual();
    }

    /// @return A user's current debt, interest-inclusive, computed live --
    /// accurate even if this position hasn't been touched since before the
    /// last accrual elsewhere in the market.
    function currentDebt(address user) external view returns (uint256) {
        return _currentDebtView(user);
    }

    /// @notice Convenience view combining collateral with live debt. The
    /// public positions mapping exposes principal/borrowIndexSnapshot
    /// instead -- those are the lazy-accrual bookkeeping fields, not what
    /// most callers actually want; this is the stable, always-current pair.
    function getPosition(address user) external view returns (uint256 collateral, uint256 debt) {
        collateral = positions[user].collateral;
        debt = _currentDebtView(user);
    }

    /// @return 18-decimal fixed point; type(uint256).max if the position has no debt.
    function healthFactor(address user) external view returns (uint256) {
        uint256 debtNative = _currentDebtView(user);
        if (debtNative == 0) return type(uint256).max;
        uint256 debtWad = _toWad(debtNative, debtDecimals);
        // Equivalent to (collateralValueWad * liquidationThreshold / WAD) * WAD / debtWad,
        // but collapsing the intermediate /WAD * WAD round-trip avoids a
        // truncation step that redundant round-trip would otherwise cause.
        return (_collateralValueWad(positions[user].collateral) * liquidationThreshold) / debtWad;
    }

    function isLiquidatable(address user) public view returns (bool) {
        uint256 debtNative = _currentDebtView(user);
        if (debtNative == 0) return false;
        uint256 maxBorrowAtLiqThresholdWad = (_collateralValueWad(positions[user].collateral) * liquidationThreshold) / WAD;
        uint256 debtWad = _toWad(debtNative, debtDecimals);
        return debtWad > maxBorrowAtLiqThresholdWad;
    }

    /// @notice True once total collateral value covers total debt -- what a
    /// keeper checks before calling HaltController.completeResume() post-CA.
    function isSystemSolvent() external view returns (bool) {
        (, uint256 pendingTotalBorrows,) = _pendingAccrual();
        return _collateralValueWad(totalCollateral) >= _toWad(pendingTotalBorrows, debtDecimals);
    }

    /// @notice Writes a position's principal/snapshot up to the CURRENT
    /// global borrowIndex (which must already be fresh -- call
    /// accrueInterest() first). After this, pos.principal IS the live debt.
    /// @return The just-synced current debt, in debtToken's native decimals.
    function _syncUserDebt(address user) internal returns (uint256) {
        Position storage pos = positions[user];
        if (pos.principal == 0) {
            pos.borrowIndexSnapshot = borrowIndex;
            return 0;
        }
        uint256 synced = (pos.principal * borrowIndex) / pos.borrowIndexSnapshot;
        pos.principal = synced;
        pos.borrowIndexSnapshot = borrowIndex;
        return synced;
    }

    /// @return A user's debt as of right now, without writing anything --
    /// uses the pending (not-yet-written) borrowIndex so this is correct
    /// regardless of when this position, or the market globally, was last touched.
    function _currentDebtView(address user) internal view returns (uint256) {
        Position memory pos = positions[user];
        if (pos.principal == 0) return 0;
        (uint256 pendingIndex,,) = _pendingAccrual();
        return (pos.principal * pendingIndex) / pos.borrowIndexSnapshot;
    }

    /// @dev What accrueInterest() would produce if called right now, without
    /// writing state. Must mirror accrueInterest()'s halt-freeze check
    /// exactly, or view functions (healthFactor, isLiquidatable, currentDebt,
    /// lpOwedBorrowsView) would show interest that a real accrual call would
    /// never actually write.
    function _pendingAccrual() internal view returns (uint256 pendingIndex, uint256 pendingTotalBorrows, uint256 pendingTotalReserves) {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        bool frozen = haltController.state() == HaltController.MarketState.HALTED;
        if (elapsed == 0 || totalBorrows == 0 || frozen) return (borrowIndex, totalBorrows, totalReserves);
        uint256 cash = debtToken.balanceOf(address(lenderVault));
        uint256 ratePerSecond = interestRateModel.getBorrowRatePerSecond(cash, totalBorrows);
        (uint256 newIndex, uint256 newTotalBorrows,, uint256 reservesAdded) =
            _computeAccrual(borrowIndex, totalBorrows, ratePerSecond, elapsed);
        return (newIndex, newTotalBorrows, totalReserves + reservesAdded);
    }

    /// @notice The one implementation of the accrual formula itself -- both
    /// accrueInterest() (which writes the result) and _pendingAccrual()
    /// (which only reads it) call this, so there's no second copy of this
    /// math that could quietly drift out of sync with the first.
    function _computeAccrual(uint256 currentIndex, uint256 currentTotalBorrows, uint256 ratePerSecond, uint256 elapsed)
        internal
        view
        returns (uint256 newIndex, uint256 newTotalBorrows, uint256 interestAccumulated, uint256 reservesAdded)
    {
        if (elapsed == 0 || currentTotalBorrows == 0) {
            return (currentIndex, currentTotalBorrows, 0, 0);
        }
        // Simple (linear) interest for the elapsed window between accrual
        // ticks, re-anchored to the running index every tick -- the same
        // approach Compound v2 uses. Approximates continuous compounding
        // well as long as accrual happens reasonably often, which it does
        // here since every state-changing call triggers it.
        uint256 interestFactor = ratePerSecond * elapsed;
        interestAccumulated = (currentTotalBorrows * interestFactor) / WAD;
        // Computed independently at full precision, not as a fraction of the
        // already-truncated interestAccumulated above -- multiplying before
        // dividing (once, at the end) instead of dividing twice avoids
        // compounding two separate truncations into reservesAdded.
        reservesAdded = (currentTotalBorrows * interestFactor * reserveFactor) / (WAD * WAD);
        newTotalBorrows = currentTotalBorrows + interestAccumulated;
        newIndex = currentIndex + (currentIndex * interestFactor) / WAD;
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
        // updatedAt/paused deliberately ignored here -- this helper backs
        // view functions (healthFactor, isSystemSolvent) that must not
        // revert just because the oracle happens to be paused; the actual
        // staleness/paused gate for state-changing actions is
        // _requireFreshPrice(), used separately by borrow()/liquidate().
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
