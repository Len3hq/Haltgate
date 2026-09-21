// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Standard two-slope ("kinked") interest rate model, the same shape
/// used by Compound v2 and Aave v2: borrow cost rises slowly with
/// utilization up to a target ("kink"), then steeply above it to pull
/// utilization back down and protect withdrawal liquidity for lenders.
/// All rates are per-second, 18-decimal WAD fixed point, so Market can
/// multiply by elapsed seconds directly without any per-block assumptions
/// (X Layer's block time isn't a constant this contract should depend on).
contract InterestRateModel is Ownable {
    uint256 private constant WAD = 1e18;
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    /// @notice Hard ceiling on kink -- 100% utilization is the max meaningful value.
    uint256 private constant MAX_KINK = WAD;
    /// @notice Ceiling on every rate leg, annualised. Kink was bounded from
    /// the start but the three rate parameters were not, which left the one
    /// contract shared by every market able to take an arbitrary borrow rate
    /// and make all five insolvent in a single call. 1,000%/yr is far above
    /// any sane curve and still far below the range where rate * elapsed
    /// starts overflowing.
    uint256 public constant MAX_RATE_PER_YEAR = 10e18;

    /// @notice Per-second rate at 0% utilization.
    uint256 public baseRatePerSecond;
    /// @notice Per-second rate added per unit of utilization, below kink.
    uint256 public multiplierPerSecond;
    /// @notice Per-second rate added per unit of utilization, above kink.
    uint256 public jumpMultiplierPerSecond;
    /// @notice Utilization (WAD) where the slope changes from multiplier to jumpMultiplier.
    uint256 public kink;

    event ParamsUpdated(uint256 baseRatePerYear, uint256 multiplierPerYear, uint256 jumpMultiplierPerYear, uint256 kink);

    error InvalidKink();
    error InvalidRate();

    constructor(
        uint256 baseRatePerYear,
        uint256 multiplierPerYear,
        uint256 jumpMultiplierPerYear,
        uint256 kink_,
        address owner_
    ) Ownable(owner_) {
        _setParams(baseRatePerYear, multiplierPerYear, jumpMultiplierPerYear, kink_);
    }

    /// @notice Atomic update of all four params together -- updating kink
    /// alone, for instance, could transiently make the curve discontinuous
    /// or invert slope 1 vs slope 2 if done as separate calls.
    function setParams(uint256 baseRatePerYear, uint256 multiplierPerYear, uint256 jumpMultiplierPerYear, uint256 kink_)
        external
        onlyOwner
    {
        _setParams(baseRatePerYear, multiplierPerYear, jumpMultiplierPerYear, kink_);
    }

    function _setParams(uint256 baseRatePerYear, uint256 multiplierPerYear, uint256 jumpMultiplierPerYear, uint256 kink_)
        internal
    {
        if (kink_ > MAX_KINK) revert InvalidKink();
        if (
            baseRatePerYear > MAX_RATE_PER_YEAR || multiplierPerYear > MAX_RATE_PER_YEAR
                || jumpMultiplierPerYear > MAX_RATE_PER_YEAR
        ) revert InvalidRate();
        baseRatePerSecond = baseRatePerYear / SECONDS_PER_YEAR;
        multiplierPerSecond = multiplierPerYear / SECONDS_PER_YEAR;
        jumpMultiplierPerSecond = jumpMultiplierPerYear / SECONDS_PER_YEAR;
        kink = kink_;
        emit ParamsUpdated(baseRatePerYear, multiplierPerYear, jumpMultiplierPerYear, kink_);
    }

    /// @return Utilization = borrows / (cash + borrows), WAD. 0 when there
    /// are no borrows at all, regardless of cash -- an idle, fully-liquid
    /// pool has 0% utilization by definition, not a division by zero.
    function utilizationRate(uint256 cash, uint256 borrows) public pure returns (uint256) {
        if (borrows == 0) return 0;
        return (borrows * WAD) / (cash + borrows);
    }

    /// @return Borrow rate, per-second WAD fixed point.
    function getBorrowRatePerSecond(uint256 cash, uint256 borrows) public view returns (uint256) {
        uint256 util = utilizationRate(cash, borrows);
        if (util <= kink) {
            return baseRatePerSecond + (util * multiplierPerSecond) / WAD;
        }
        uint256 rateAtKink = baseRatePerSecond + (kink * multiplierPerSecond) / WAD;
        uint256 excessUtil = util - kink;
        return rateAtKink + (excessUtil * jumpMultiplierPerSecond) / WAD;
    }

    /// @return Supply rate, per-second WAD fixed point -- the borrow rate,
    /// scaled down by utilization (idle cash earns nothing) and by
    /// (1 - reserveFactor) (the protocol's cut never reaches lenders).
    function getSupplyRatePerSecond(uint256 cash, uint256 borrows, uint256 reserveFactor) external view returns (uint256) {
        uint256 util = utilizationRate(cash, borrows);
        uint256 borrowRate = getBorrowRatePerSecond(cash, borrows);
        // All three multiplications before the single final division --
        // dividing rateToPool out first (matmul in two steps) would throw
        // away precision that this combined form keeps.
        return (util * borrowRate * (WAD - reserveFactor)) / (WAD * WAD);
    }
}
