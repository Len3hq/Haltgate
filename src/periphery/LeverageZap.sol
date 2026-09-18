// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Market} from "../core/Market.sol";
import {SwapModule} from "./SwapModule.sol";

/// @notice Leveraged long in one transaction (BUILD.md §11 Milestones 1-2).
/// `leverage()` runs a single supply -> borrow -> swap -> supply pass;
/// `multiply()` repeats that pass until a target leverage multiple is
/// reached. Both share one internal step implementation so the two paths
/// can't drift apart.
///
/// Stateless and permissionless: takes `market` and `swapModule` as call
/// parameters rather than being fixed to one pair at deploy time, so one
/// deployment keeps working once BUILD.md §11 Milestone 4 adds more markets.
///
/// Requires the caller to have already called
/// `market.setOperator(address(this), true)` -- Market.supply()/borrow() are
/// hardcoded to credit msg.sender's own position, so this contract calling
/// them directly would otherwise end up owning the resulting position
/// itself instead of the user who actually wants it. supplyFor()/
/// borrowFor() exist specifically to let an authorized operator act on a
/// user's behalf while still crediting that user, not the caller.
contract LeverageZap is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant WAD = 1e18;

    /// @notice Hard ceiling on requested leverage, enforced here and not only
    /// in the UI. The real binding limit is usually far lower: a market's own
    /// maxLTV caps achievable leverage at 1 / (1 - maxLTV), which is 2x at the
    /// current 50% maxLTV. This is a sanity bound on the input, not a promise
    /// the market can deliver it -- `minFinalCollateral` is what actually
    /// protects the caller from being under-delivered.
    uint256 public constant MAX_LEVERAGE = 5e18;

    /// @notice Gas bound on the loop. Each pass closes roughly maxLTV of the
    /// remaining gap to the target, so the series converges quickly -- at a
    /// 50% maxLTV, 8 passes reach ~99% of the theoretical maximum.
    uint256 private constant MAX_ITERATIONS = 10;

    event Leveraged(
        address indexed user, address indexed market, uint256 initialCollateralIn, uint256 borrowed, uint256 collateralFromSwap
    );
    event Multiplied(
        address indexed user,
        address indexed market,
        uint256 initialCollateralIn,
        uint256 totalBorrowed,
        uint256 finalCollateral,
        uint256 loops
    );

    error ZeroAddress();
    error MismatchedSwapModule();
    error SlippageTooHigh();
    error InvalidLeverage();

    /// @param market The isolated market to leverage into.
    /// @param swapModule Must be the SwapModule for this exact market's
    /// collateral/debt pair -- checked, not assumed, since a mismatched one
    /// passed by a buggy or malicious caller would misdirect real funds.
    /// @param initialCollateralIn Collateral supplied up front, pulled from
    /// the caller. Zero is valid -- amplifying an existing position with
    /// just a borrow+swap+supply loop and no fresh deposit.
    /// @param borrowAmount How much debt token to borrow and swap into more
    /// collateral, chosen by the caller.
    /// @param minCollateralOut Slippage floor on the swap leg.
    function leverage(
        Market market,
        SwapModule swapModule,
        uint256 initialCollateralIn,
        uint256 borrowAmount,
        uint256 minCollateralOut
    ) external nonReentrant {
        (IERC20 collateralToken, IERC20 debtToken) = _validate(market, swapModule);
        _pullAndSupply(market, collateralToken, initialCollateralIn);

        uint256 collateralOut = _loopOnce(market, swapModule, collateralToken, debtToken, borrowAmount);
        if (collateralOut < minCollateralOut) revert SlippageTooHigh();

        emit Leveraged(msg.sender, address(market), initialCollateralIn, borrowAmount, collateralOut);
    }

    /// @notice Repeats the borrow -> swap -> supply loop until the position's
    /// collateral reaches `targetLeverageWad` times what it holds after the
    /// initial deposit, or until the market's own LTV limit / available
    /// liquidity stops it -- whichever comes first.
    ///
    /// Deliberately stops early rather than reverting when the target can't
    /// be fully reached: at a 50% maxLTV the theoretical ceiling (2x) is an
    /// asymptote that no finite number of loops ever actually touches, so
    /// "revert unless the target is hit exactly" would reject perfectly
    /// reasonable requests. `minFinalCollateral` is the caller's actual
    /// protection -- it declares the least they're willing to end up with,
    /// and the whole transaction reverts below it.
    ///
    /// Note the target applies to the position as a whole, including any
    /// collateral supplied before this call, not just `initialCollateralIn`.
    /// @param targetLeverageWad WAD multiple, e.g. 2e18 for 2x. Must be
    /// above 1x and at or below MAX_LEVERAGE.
    /// @param minFinalCollateral Floor on the position's total collateral
    /// once the loop finishes.
    function multiply(
        Market market,
        SwapModule swapModule,
        uint256 initialCollateralIn,
        uint256 targetLeverageWad,
        uint256 minFinalCollateral
    ) external nonReentrant {
        if (targetLeverageWad <= WAD || targetLeverageWad > MAX_LEVERAGE) revert InvalidLeverage();
        (IERC20 collateralToken, IERC20 debtToken) = _validate(market, swapModule);
        _pullAndSupply(market, collateralToken, initialCollateralIn);

        uint256 targetCollateral;
        {
            (uint256 baseCollateral,) = market.getPosition(msg.sender);
            targetCollateral = (baseCollateral * targetLeverageWad) / WAD;
        }

        uint256 totalBorrowed = 0;
        uint256 loops = 0;
        for (uint256 i = 0; i < MAX_ITERATIONS; i++) {
            uint256 borrowAmount = _nextBorrow(market, swapModule, targetCollateral);
            if (borrowAmount == 0) break;

            _loopOnce(market, swapModule, collateralToken, debtToken, borrowAmount);
            totalBorrowed += borrowAmount;
            loops++;
        }

        (uint256 finalCollateral,) = market.getPosition(msg.sender);
        if (finalCollateral < minFinalCollateral) revert SlippageTooHigh();

        emit Multiplied(msg.sender, address(market), initialCollateralIn, totalBorrowed, finalCollateral, loops);
    }

    /// @dev One borrow -> swap -> supply pass. Shared by both entry points so
    /// a fix to the sequence can never land in one and miss the other.
    function _loopOnce(
        Market market,
        SwapModule swapModule,
        IERC20 collateralToken,
        IERC20 debtToken,
        uint256 borrowAmount
    ) internal returns (uint256 collateralOut) {
        market.borrowFor(msg.sender, borrowAmount);
        debtToken.forceApprove(address(swapModule), borrowAmount);
        collateralOut = swapModule.swapDebtForCollateral(borrowAmount, address(this));
        collateralToken.forceApprove(address(market), collateralOut);
        market.supplyFor(msg.sender, collateralOut);
    }

    /// @dev How much to borrow on the next pass: enough to close the gap to
    /// `targetCollateral`, but never more than the position's remaining LTV
    /// headroom or the vault's actual liquid cash. Returning zero means the
    /// loop is done -- either the target is reached, or the market can't
    /// safely lend any more against this position.
    ///
    /// The headroom figure mirrors Market._maxBorrowableNative exactly; the
    /// gap-to-debt conversion is the algebraic inverse of
    /// SwapModule.swapDebtForCollateral's own pricing, so a pass never
    /// overshoots the requested multiple and lands the caller in more risk
    /// than they asked for.
    function _nextBorrow(Market market, SwapModule swapModule, uint256 targetCollateral)
        internal
        view
        returns (uint256)
    {
        (uint256 collateral, uint256 debt) = market.getPosition(msg.sender);
        if (collateral >= targetCollateral) return 0;

        (uint256 price,,) = market.oracle().latestPrice();
        if (price == 0) return 0;

        uint8 collateralDecimals = market.collateralDecimals();
        uint8 debtDecimals = market.debtDecimals();

        uint256 headroom;
        {
            // Deliberately kept as two separate divisions, mirroring
            // Market._collateralValueWad -> _maxBorrowableNative step for
            // step, rather than collapsed into one multiply-then-divide the
            // way the rest of this codebase prefers. Collapsing it would be
            // *more* precise and therefore wrong here: this figure has to
            // match what Market itself will enforce, to the wei. Round even
            // one wei higher than Market does and the very next borrowFor()
            // reverts with ExceedsMaxLTV, killing the whole loop.
            uint256 collateralValueWad = (_toWad(collateral, collateralDecimals) * price) / WAD;
            uint256 maxDebt = _fromWad((collateralValueWad * market.maxLTV()) / WAD, debtDecimals);
            if (maxDebt <= debt) return 0;
            headroom = maxDebt - debt;
        }

        uint256 needed;
        {
            uint256 gapWad = _toWad(targetCollateral - collateral, collateralDecimals);
            // Inverse of SwapModule's collateralWad = debtWad * (WAD - fee) / price.
            uint256 neededWad = (gapWad * price) / (WAD - swapModule.feeWad());
            needed = _fromWad(neededWad, debtDecimals) + 1; // round up so a pass can actually close the gap
        }

        uint256 cash = market.debtToken().balanceOf(address(market.lenderVault()));
        uint256 borrowAmount = needed < headroom ? needed : headroom;
        return borrowAmount < cash ? borrowAmount : cash;
    }

    function _validate(Market market, SwapModule swapModule) internal view returns (IERC20, IERC20) {
        if (address(market) == address(0) || address(swapModule) == address(0)) revert ZeroAddress();
        IERC20 collateralToken = market.collateralToken();
        IERC20 debtToken = market.debtToken();
        if (swapModule.collateralToken() != collateralToken || swapModule.debtToken() != debtToken) {
            revert MismatchedSwapModule();
        }
        return (collateralToken, debtToken);
    }

    function _pullAndSupply(Market market, IERC20 collateralToken, uint256 amount) internal {
        if (amount == 0) return;
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        collateralToken.forceApprove(address(market), amount);
        market.supplyFor(msg.sender, amount);
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
