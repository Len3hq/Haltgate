// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Market} from "../core/Market.sol";
import {SwapModule} from "./SwapModule.sol";

/// @notice One-click leveraged long (BUILD.md §11 Milestone 1): supply
/// collateral, borrow against it, swap the borrowed debt token for more
/// collateral via SwapModule, and supply that too -- all in a single
/// transaction, instead of the four separate manual transactions this
/// otherwise takes.
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

    event Leveraged(
        address indexed user, address indexed market, uint256 initialCollateralIn, uint256 borrowed, uint256 collateralFromSwap
    );

    error ZeroAddress();
    error MismatchedSwapModule();
    error SlippageTooHigh();

    /// @param market The isolated market to leverage into.
    /// @param swapModule Must be the SwapModule for this exact market's
    /// collateral/debt pair -- checked, not assumed, since a mismatched one
    /// passed by a buggy or malicious caller would misdirect real funds.
    /// @param initialCollateralIn Collateral supplied up front, pulled from
    /// the caller. Zero is valid -- amplifying an existing position with
    /// just a borrow+swap+supply loop and no fresh deposit.
    /// @param borrowAmount How much debt token to borrow and swap into more
    /// collateral. Chosen by the caller (typically the frontend, computed
    /// against the market's own maxLTV) -- this contract doesn't compute a
    /// target leverage multiple itself; see Milestone 2 (Multiply) for that.
    /// @param minCollateralOut Slippage floor on the swap leg.
    function leverage(
        Market market,
        SwapModule swapModule,
        uint256 initialCollateralIn,
        uint256 borrowAmount,
        uint256 minCollateralOut
    ) external nonReentrant {
        if (address(market) == address(0) || address(swapModule) == address(0)) revert ZeroAddress();
        IERC20 collateralToken = market.collateralToken();
        IERC20 debtToken = market.debtToken();
        if (swapModule.collateralToken() != collateralToken || swapModule.debtToken() != debtToken) {
            revert MismatchedSwapModule();
        }

        if (initialCollateralIn > 0) {
            collateralToken.safeTransferFrom(msg.sender, address(this), initialCollateralIn);
            collateralToken.forceApprove(address(market), initialCollateralIn);
            market.supplyFor(msg.sender, initialCollateralIn);
        }

        market.borrowFor(msg.sender, borrowAmount);

        debtToken.forceApprove(address(swapModule), borrowAmount);
        uint256 collateralOut = swapModule.swapDebtForCollateral(borrowAmount, address(this));
        if (collateralOut < minCollateralOut) revert SlippageTooHigh();

        collateralToken.forceApprove(address(market), collateralOut);
        market.supplyFor(msg.sender, collateralOut);

        emit Leveraged(msg.sender, address(market), initialCollateralIn, borrowAmount, collateralOut);
    }
}
