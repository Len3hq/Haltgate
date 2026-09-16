// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {InterestRateModel} from "../../src/core/InterestRateModel.sol";

contract InterestRateModelTest is Test {
    InterestRateModel irm;
    address owner = address(0xA11CE);

    uint256 constant SECONDS_PER_YEAR = 365 days;
    uint256 constant BASE_RATE = 0;
    uint256 constant MULTIPLIER = 0.1e18; // 10%/yr
    uint256 constant JUMP_MULTIPLIER = 3.0e18; // 300%/yr
    uint256 constant KINK = 0.8e18; // 80%

    function setUp() public {
        irm = new InterestRateModel(BASE_RATE, MULTIPLIER, JUMP_MULTIPLIER, KINK, owner);
    }

    function test_UtilizationRate_ZeroWhenNoBorrows() public view {
        assertEq(irm.utilizationRate(0, 0), 0, "no cash, no borrows -- still 0% util, not a division by zero");
        assertEq(irm.utilizationRate(1_000e18, 0), 0, "idle fully-liquid pool is 0% utilization");
    }

    function test_UtilizationRate_HundredPercentWhenNoCash() public view {
        assertEq(irm.utilizationRate(0, 1_000e18), 1e18, "all liquidity borrowed out -- 100% utilization");
    }

    function test_UtilizationRate_Half() public view {
        assertEq(irm.utilizationRate(500e18, 500e18), 0.5e18);
    }

    function test_BorrowRate_ZeroAtZeroUtilization() public view {
        assertEq(irm.getBorrowRatePerSecond(1_000e18, 0), BASE_RATE / SECONDS_PER_YEAR);
    }

    function test_BorrowRate_BelowKink_LinearInMultiplier() public view {
        // 40% utilization, half of kink -- rate should be base + 0.4*multiplier
        uint256 rate = irm.getBorrowRatePerSecond(600e18, 400e18);
        uint256 expected = (BASE_RATE / SECONDS_PER_YEAR) + (0.4e18 * (MULTIPLIER / SECONDS_PER_YEAR)) / 1e18;
        assertEq(rate, expected);
    }

    function test_BorrowRate_ExactlyAtKink_MatchesBothSlopeFormulas() public view {
        // At the kink, slope-1 and slope-2 formulas must agree exactly --
        // a discontinuity here would mean a borrower's rate jumps or drops
        // the instant utilization crosses 80% by a single wei either way.
        uint256 rateAtKinkFromBelow = irm.getBorrowRatePerSecond(200e18, 800e18); // exactly 80% util
        uint256 rateAtKinkExpected = (BASE_RATE / SECONDS_PER_YEAR) + (KINK * (MULTIPLIER / SECONDS_PER_YEAR)) / 1e18;
        assertEq(rateAtKinkFromBelow, rateAtKinkExpected);
    }

    function test_BorrowRate_AboveKink_UsesJumpMultiplier() public view {
        // 90% utilization -- 10 points past the kink, should use jumpMultiplier for that excess.
        uint256 rate = irm.getBorrowRatePerSecond(100e18, 900e18);
        uint256 rateAtKink = (BASE_RATE / SECONDS_PER_YEAR) + (KINK * (MULTIPLIER / SECONDS_PER_YEAR)) / 1e18;
        uint256 excess = 0.9e18 - KINK;
        uint256 expected = rateAtKink + (excess * (JUMP_MULTIPLIER / SECONDS_PER_YEAR)) / 1e18;
        assertEq(rate, expected);
    }

    function test_BorrowRate_MonotonicallyIncreasingWithUtilization() public view {
        uint256 prevRate = 0;
        for (uint256 util = 0; util <= 100; util += 5) {
            uint256 borrows = util * 10e18;
            uint256 cash = (100 - util) * 10e18;
            uint256 rate = irm.getBorrowRatePerSecond(cash, borrows);
            assertGe(rate, prevRate, "borrow rate must never decrease as utilization rises");
            prevRate = rate;
        }
    }

    function test_BorrowRate_SteeperAboveKinkThanBelow() public view {
        // The whole point of a kink: slope after it must be strictly
        // steeper than the slope before it, or there's no reason to have one.
        uint256 rateAt70 = irm.getBorrowRatePerSecond(300e18, 700e18);
        uint256 rateAt80 = irm.getBorrowRatePerSecond(200e18, 800e18);
        uint256 rateAt90 = irm.getBorrowRatePerSecond(100e18, 900e18);
        uint256 slopeBelow = rateAt80 - rateAt70; // per 10 points of utilization
        uint256 slopeAbove = rateAt90 - rateAt80;
        assertGt(slopeAbove, slopeBelow, "slope above the kink must be steeper than below it");
    }

    function test_SupplyRate_ZeroReserveFactor_MatchesUtilizationTimesBorrowRate() public view {
        uint256 borrowRate = irm.getBorrowRatePerSecond(200e18, 800e18);
        uint256 util = irm.utilizationRate(200e18, 800e18);
        uint256 supplyRate = irm.getSupplyRatePerSecond(200e18, 800e18, 0);
        assertEq(supplyRate, (util * borrowRate) / 1e18);
    }

    function test_SupplyRate_AlwaysAtMostBorrowRate() public view {
        // Lenders can never earn more than borrowers pay in aggregate --
        // true regardless of utilization or reserveFactor.
        uint256 borrowRate = irm.getBorrowRatePerSecond(300e18, 700e18);
        uint256 supplyRateNoReserve = irm.getSupplyRatePerSecond(300e18, 700e18, 0);
        uint256 supplyRateWithReserve = irm.getSupplyRatePerSecond(300e18, 700e18, 0.2e18);
        assertLe(supplyRateNoReserve, borrowRate);
        assertLe(supplyRateWithReserve, supplyRateNoReserve, "a nonzero reserve factor must only ever reduce lender yield");
    }

    function test_SupplyRate_ZeroAtZeroUtilization_RegardlessOfBorrowRate() public {
        // Idle cash earns nothing, even if the base rate itself is nonzero.
        InterestRateModel irmWithBase = new InterestRateModel(0.05e18, MULTIPLIER, JUMP_MULTIPLIER, KINK, owner);
        assertEq(irmWithBase.getSupplyRatePerSecond(1_000e18, 0, 0), 0);
    }

    function test_SetParams_OnlyOwner() public {
        vm.expectRevert();
        irm.setParams(0, 0.2e18, 4e18, 0.9e18);

        vm.prank(owner);
        irm.setParams(0, 0.2e18, 4e18, 0.9e18);
        assertEq(irm.kink(), 0.9e18);
    }

    function test_Constructor_RevertsIfKinkAboveHundredPercent() public {
        vm.expectRevert(InterestRateModel.InvalidKink.selector);
        new InterestRateModel(0, MULTIPLIER, JUMP_MULTIPLIER, 1e18 + 1, owner);
    }

    function test_Constructor_AllowsKinkAtExactlyHundredPercent() public {
        InterestRateModel edge = new InterestRateModel(0, MULTIPLIER, JUMP_MULTIPLIER, 1e18, owner);
        assertEq(edge.kink(), 1e18);
        // At kink == 100%, utilization can never exceed it, so the jump
        // slope is unreachable -- must not revert or misbehave.
        uint256 rate = edge.getBorrowRatePerSecond(0, 1_000e18);
        assertGt(rate, 0);
    }

    function test_SetParams_RevertsIfKinkAboveHundredPercent() public {
        vm.prank(owner);
        vm.expectRevert(InterestRateModel.InvalidKink.selector);
        irm.setParams(0, MULTIPLIER, JUMP_MULTIPLIER, 1e18 + 1);
    }
}
