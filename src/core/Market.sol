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

/// @notice Single isolated market: supply wNVDAx, borrow USDG from LenderVault,
/// repay with interest -- gated throughout by HaltController so a
/// corporate-action price discontinuity can't be borrowed or liquidated against.
///
/// Decimals: positions store native decimals, but every value comparison is
/// normalized to WAD first. Real USDG is 6 decimals, not 18 -- skipping that
/// would be silently wrong by 10^12.
///
/// Interest: Compound-v2 borrow index. Debt is recovered lazily as
/// `principal * borrowIndex / snapshotIndex`, never by iterating positions.
/// View functions also compute pending accrual, so they stay accurate between
/// transactions -- understating live debt in a health check is a safety bug.
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
    /// @notice Max age of the oracle's last update before borrow/liquidate stop
    /// trusting it. Independent of HaltController, which only updates when
    /// someone calls sync() -- so it can report OPEN against a stale feed.
    uint256 public maxOracleStaleness;

    /// @notice WAD, grows monotonically as interest accrues. Never resets.
    uint256 public borrowIndex = WAD;
    uint256 public totalBorrows;
    uint256 public totalReserves;
    uint256 public lastAccrualTimestamp;

    mapping(address => Position) public positions;
    uint256 public totalCollateral;

    /// @notice A fixed-rate, fixed-term loan. Deliberately holds its own
    /// collateral rather than sharing the variable position's, so liquidation
    /// can never seize collateral backing a loan that by design cannot be
    /// liquidated.
    struct FixedLoan {
        uint256 collateral; // locked for the term, collateralToken's decimals
        uint256 principal; // debtToken's decimals
        uint256 owed; // principal + interest, fixed at origination
        uint256 maturity; // unix seconds
    }

    mapping(address => FixedLoan) public fixedLoans;
    /// @notice Sum of outstanding fixed principal. Interest is recognised at
    /// repayment rather than accrued, so the vault never marks up unearned yield.
    uint256 public totalFixedPrincipal;
    /// @notice Collateral claimed from defaulted loans, awaiting conversion to
    /// debt token by governance.
    uint256 public seizedCollateral;

    /// @notice LTV ceiling for fixed-term loans. Lower than maxLTV because
    /// nothing can liquidate these mid-term -- the opening cushion is the only
    /// protection, so it has to survive the whole term.
    uint256 public fixedMaxLTV;
    /// @notice Fixed borrow rate, WAD per year. Priced above the variable curve:
    /// the borrower is buying rate certainty and freedom from liquidation.
    uint256 public fixedRatePerYear;

    /// @notice Share of the seized collateral paid to whoever calls
    /// settleMatured(), WAD. settleMatured() is permissionless but hands the
    /// caller nothing by default, so without this nobody is paid to close a
    /// defaulted loan and the vault keeps carrying it at full face value.
    /// Denominated in collateral tokens, so paying it needs no price.
    uint256 public settlementBounty;

    uint256 public constant MIN_FIXED_TERM = 1 days;
    uint256 public constant MAX_FIXED_TERM = 30 days;
    /// @notice Ceiling on settlementBounty. A settler supplies only gas, unlike
    /// a liquidator who must front the debt, so this sits far below liquidationBonus.
    uint256 public constant MAX_SETTLEMENT_BOUNTY = 0.02e18;
    /// @notice Ceiling on liquidationBonus. Unbounded, a liquidator repaying
    /// dust could seize a whole position: collateralSeized is clamped to the
    /// position, so the clamp stops the underflow but not the theft.
    uint256 public constant MAX_LIQUIDATION_BONUS = 0.2e18;
    /// @notice Bounds on maxOracleStaleness. The floor stops governance
    /// setting it so low that every price-dependent call reverts; the ceiling
    /// stops the freshness backstop being disabled by setting it enormous.
    uint256 public constant MIN_ORACLE_STALENESS = 1 hours;
    uint256 public constant MAX_ORACLE_STALENESS = 7 days;

    /// @notice owner => operator => approved. Like an ERC20 approve: revocable,
    /// and grantable only by the position owner over themselves. Exists so a
    /// leverage loop credits the user's position rather than the zap's own.
    mapping(address => mapping(address => bool)) public isOperator;

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
    event OperatorSet(address indexed owner, address indexed operator, bool approved);
    event FixedBorrowed(address indexed user, uint256 collateral, uint256 principal, uint256 owed, uint256 maturity);
    event FixedRepaid(address indexed user, uint256 owed, uint256 collateralReturned);
    event FixedDefaulted(
        address indexed user, address indexed by, uint256 principal, uint256 collateralSeized, uint256 bounty
    );
    event FixedParamsUpdated(uint256 fixedMaxLTV, uint256 fixedRatePerYear);
    event SeizedCollateralWithdrawn(address indexed to, uint256 amount);
    event SettlementBountyUpdated(uint256 settlementBounty);

    error MarketHalted();
    error NotAuthorized();
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
    error InvalidTerm();
    error LoanAlreadyOpen();
    error NoFixedLoan();
    error NotMatured(uint256 maturity);
    error InvalidFixedParams();
    error InvalidBounty();

    modifier whenSupplyOrBorrowAllowed() {
        if (!haltController.canSupplyOrBorrow()) revert MarketHalted();
        _;
    }

    modifier onlySelfOrOperator(address onBehalfOf) {
        if (msg.sender != onBehalfOf && !isOperator[onBehalfOf][msg.sender]) revert NotAuthorized();
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

    /// @notice setFixedParams refuses to raise the fixed LTV above this one;
    /// this refuses to lower this one beneath the fixed LTV. Guarding only the
    /// first direction let governance strand fixedMaxLTV above maxLTV, leaving
    /// the loan nothing can liquidate borrowing the more per unit of collateral.
    /// Lowering both means lowering the fixed LTV first.
    function setRiskParams(uint256 newMaxLTV, uint256 newLiquidationThreshold) external onlyOwner {
        if (newLiquidationThreshold <= newMaxLTV || newLiquidationThreshold > WAD) revert InvalidRiskParams();
        if (fixedMaxLTV > newMaxLTV) revert InvalidRiskParams();
        maxLTV = newMaxLTV;
        liquidationThreshold = newLiquidationThreshold;
        emit RiskParamsUpdated(newMaxLTV, newLiquidationThreshold);
    }

    function setLiquidationBonus(uint256 newBonus) external onlyOwner {
        if (newBonus > MAX_LIQUIDATION_BONUS) revert InvalidRiskParams();
        liquidationBonus = newBonus;
        emit LiquidationBonusUpdated(newBonus);
    }

    function setMaxOracleStaleness(uint256 newMaxStaleness) external onlyOwner {
        if (newMaxStaleness < MIN_ORACLE_STALENESS || newMaxStaleness > MAX_ORACLE_STALENESS) {
            revert InvalidRiskParams();
        }
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

    /// @notice Grant/revoke supplyFor()/borrowFor() rights over your own
    /// position. No path exists to set an operator on someone else's behalf.
    function setOperator(address operator, bool approved) external {
        if (operator == address(0)) revert ZeroAddress();
        isOperator[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
    }

    function supply(uint256 amount) external nonReentrant whenSupplyOrBorrowAllowed {
        _supply(msg.sender, msg.sender, amount);
    }

    /// @notice supply(), but pulling from msg.sender and crediting onBehalfOf.
    /// Requires onBehalfOf to have called setOperator(msg.sender, true).
    function supplyFor(address onBehalfOf, uint256 amount)
        external
        nonReentrant
        whenSupplyOrBorrowAllowed
        onlySelfOrOperator(onBehalfOf)
    {
        _supply(msg.sender, onBehalfOf, amount);
    }

    function _supply(address payer, address onBehalfOf, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        positions[onBehalfOf].collateral += amount;
        totalCollateral += amount;
        collateralToken.safeTransferFrom(payer, address(this), amount);
        emit Supplied(onBehalfOf, amount);
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
        _borrow(msg.sender, msg.sender, amount);
    }

    /// @notice borrow(), but debting onBehalfOf and sending the cash to
    /// msg.sender -- e.g. a zap that swaps it on within the same transaction.
    /// Requires onBehalfOf to have called setOperator(msg.sender, true).
    function borrowFor(address onBehalfOf, uint256 amount)
        external
        nonReentrant
        whenSupplyOrBorrowAllowed
        onlySelfOrOperator(onBehalfOf)
    {
        _borrow(msg.sender, onBehalfOf, amount);
    }

    function _borrow(address recipient, address onBehalfOf, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        accrueInterest();
        _requireFreshPrice();

        uint256 availableCash = debtToken.balanceOf(address(lenderVault));
        if (amount > availableCash) revert InsufficientLiquidity();

        Position storage pos = positions[onBehalfOf];
        uint256 syncedDebt = _syncUserDebt(onBehalfOf);
        uint256 newDebt = syncedDebt + amount;
        if (newDebt > _maxBorrowableNative(pos.collateral)) revert ExceedsMaxLTV();

        pos.principal = newDebt;
        totalBorrows += amount;
        lenderVault.borrowCash(recipient, amount);
        emit Borrowed(onBehalfOf, amount);
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

    // --- Fixed-rate, fixed-term loans ------------------------------------
    //
    // A deliberately different risk model from the variable market above:
    // the rate is locked at origination and the position can never be
    // liquidated on price, however far the collateral falls. Maturity
    // replaces liquidation as the mechanism that resolves the loan.
    //
    // That removes the oracle from the loan's whole lifecycle except at
    // origination, which is the point -- but it also means the opening
    // cushion is the lender's only protection for the full term, so
    // fixedMaxLTV is set well below maxLTV.

    function setFixedParams(uint256 newFixedMaxLTV, uint256 newFixedRatePerYear) external onlyOwner {
        // Never looser than the liquidatable market: a loan nothing can close
        // out must not be allowed to borrow more per unit of collateral.
        if (newFixedMaxLTV == 0 || newFixedMaxLTV > maxLTV) revert InvalidFixedParams();
        fixedMaxLTV = newFixedMaxLTV;
        fixedRatePerYear = newFixedRatePerYear;
        emit FixedParamsUpdated(newFixedMaxLTV, newFixedRatePerYear);
    }

    /// @notice Sets the settler's cut of seized collateral. Kept separate from
    /// setFixedParams so an incentive can be tuned without touching risk limits.
    function setSettlementBounty(uint256 newSettlementBounty) external onlyOwner {
        if (newSettlementBounty > MAX_SETTLEMENT_BOUNTY) revert InvalidBounty();
        settlementBounty = newSettlementBounty;
        emit SettlementBountyUpdated(newSettlementBounty);
    }

    /// @notice Total repayable at maturity for `principal` over `term`. Simple
    /// interest, computed once and then immutable -- that fixity is the product.
    function quoteFixed(uint256 principal, uint256 term) public view returns (uint256 owed) {
        return principal + (principal * fixedRatePerYear * term) / (WAD * 365 days);
    }

    /// @notice Open a fixed-term loan against its own dedicated collateral.
    /// One loan per address at a time, which keeps maturity unambiguous.
    function borrowFixed(uint256 collateralAmount, uint256 borrowAmount, uint256 term)
        external
        nonReentrant
        whenSupplyOrBorrowAllowed
    {
        if (collateralAmount == 0 || borrowAmount == 0) revert ZeroAmount();
        if (term < MIN_FIXED_TERM || term > MAX_FIXED_TERM) revert InvalidTerm();
        if (fixedLoans[msg.sender].principal != 0) revert LoanAlreadyOpen();
        if (fixedMaxLTV == 0) revert InvalidFixedParams();

        _requireFreshPrice();
        if (borrowAmount > debtToken.balanceOf(address(lenderVault))) revert InsufficientLiquidity();

        uint256 maxBorrowWad = (_collateralValueWad(collateralAmount) * fixedMaxLTV) / WAD;
        if (_toWad(borrowAmount, debtDecimals) > maxBorrowWad) revert ExceedsMaxLTV();

        uint256 owed = quoteFixed(borrowAmount, term);
        fixedLoans[msg.sender] =
            FixedLoan({collateral: collateralAmount, principal: borrowAmount, owed: owed, maturity: block.timestamp + term});
        totalFixedPrincipal += borrowAmount;

        collateralToken.safeTransferFrom(msg.sender, address(this), collateralAmount);
        lenderVault.borrowCash(msg.sender, borrowAmount);
        emit FixedBorrowed(msg.sender, collateralAmount, borrowAmount, owed, block.timestamp + term);
    }

    /// @notice Repay in full and unlock the collateral. Allowed in every state,
    /// halts included -- same reasoning as repay(): it only reduces risk.
    function repayFixed() external nonReentrant {
        FixedLoan memory loan = fixedLoans[msg.sender];
        if (loan.principal == 0) revert NoFixedLoan();

        delete fixedLoans[msg.sender];
        totalFixedPrincipal -= loan.principal;

        // Principal returns to the vault as cash; the interest on top lifts the
        // share price at that moment rather than having been accrued in advance.
        debtToken.safeTransferFrom(msg.sender, address(lenderVault), loan.owed);
        collateralToken.safeTransfer(msg.sender, loan.collateral);
        emit FixedRepaid(msg.sender, loan.owed, loan.collateral);
    }

    /// @notice After maturity, anyone can close out an unpaid loan by claiming
    /// its collateral outright. No price is read and no partial seizure is
    /// computed: pricing the seizure would put the oracle back in the middle of
    /// the one product designed not to need it. The conservative fixedMaxLTV is
    /// what makes claiming the whole position fair to both sides.
    ///
    /// Gated on canLiquidate() for the same reason liquidation is: a borrower
    /// should never lose collateral during a window when the market itself is
    /// halted. Repayment stays open throughout, so they are never shut out.
    function settleMatured(address user) external nonReentrant {
        if (!haltController.canLiquidate()) revert MarketHalted();
        FixedLoan memory loan = fixedLoans[user];
        if (loan.principal == 0) revert NoFixedLoan();
        if (block.timestamp < loan.maturity) revert NotMatured(loan.maturity);

        delete fixedLoans[user];
        totalFixedPrincipal -= loan.principal;

        // Bounty first, remainder to the protocol. Effects before interaction.
        uint256 bounty = (loan.collateral * settlementBounty) / WAD;
        uint256 retained = loan.collateral - bounty;
        seizedCollateral += retained;

        if (bounty != 0) collateralToken.safeTransfer(msg.sender, bounty);
        emit FixedDefaulted(user, msg.sender, loan.principal, retained, bounty);
    }

    /// @notice Moves claimed collateral out for conversion back into debt token.
    /// Seizure yields collateral while the vault is owed cash, so closing that
    /// gap is a governance step rather than something settlement can do inline.
    function withdrawSeizedCollateral(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > seizedCollateral) revert InsufficientCollateral();
        seizedCollateral -= amount;
        collateralToken.safeTransfer(to, amount);
        emit SeizedCollateralWithdrawn(to, amount);
    }

    /// @return Whether the loan is past maturity and unpaid.
    function isFixedDefaulted(address user) external view returns (bool) {
        FixedLoan memory loan = fixedLoans[user];
        return loan.principal != 0 && block.timestamp >= loan.maturity;
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
        if (haltController.interestFrozen()) return;

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
        bool frozen = haltController.interestFrozen();
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
