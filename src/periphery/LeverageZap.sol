// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Market} from "../core/Market.sol";
import {SwapModule} from "./SwapModule.sol";

/// @notice Leveraged long in one transaction. `leverage()` runs a single
/// supply -> borrow -> swap -> supply pass; `multiply()` repeats it to a target
/// multiple. Both share one internal step so they can't drift apart.
///
/// Stateless: market and swapModule are call parameters, not deploy-time
/// constants, so one deployment survives redeploys and future markets.
///
/// Caller must first call `market.setOperator(address(this), true)` -- Market
/// credits msg.sender, so without that this contract would own the position.
contract LeverageZap is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant WAD = 1e18;

    /// @notice Sanity bound on the input, not a promise it's reachable -- maxLTV
    /// caps real leverage at 1/(1-maxLTV), i.e. 2x at 50%. minFinalCollateral
    /// is what protects the caller from under-delivery.
    uint256 public constant MAX_LEVERAGE = 5e18;

    /// @notice Gas bound. Each pass closes ~maxLTV of the remaining gap, so the
    /// series converges fast.
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

    /// @notice Loops borrow -> swap -> supply until collateral reaches
    /// `targetLeverageWad` times the post-deposit position, or LTV headroom or
    /// liquidity stops it. Stops early rather than reverting, because the
    /// theoretical ceiling is an asymptote no finite loop count reaches.
    /// Applies to the whole position, not just `initialCollateralIn`.
    /// @param targetLeverageWad WAD multiple (2e18 = 2x), above 1x, <= MAX_LEVERAGE.
    /// @param minFinalCollateral Floor on final collateral; reverts below it.
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
        // Leave nothing standing. `market` is caller-supplied and only checked
        // for a matching token pair, so any allowance surviving this call is
        // one an arbitrary address could draw on later.
        collateralToken.forceApprove(address(market), 0);
        debtToken.forceApprove(address(swapModule), 0);
    }

    /// @dev Next pass's borrow: enough to close the gap to `targetCollateral`,
    /// capped by LTV headroom and vault cash. Zero means the loop is done.
    /// Never overshoots the requested multiple.
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
            // Two divisions on purpose, mirroring Market's own rounding step
            // for step. Collapsing them would be more precise and therefore
            // wrong: round one wei high and the next borrowFor() reverts
            // ExceedsMaxLTV, killing the loop.
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
        collateralToken.forceApprove(address(market), 0); // see _loopOnce
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
