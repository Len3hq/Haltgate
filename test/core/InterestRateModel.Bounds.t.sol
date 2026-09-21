// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {InterestRateModel} from "../../src/core/InterestRateModel.sol";

/// @notice Audit (2026-09-21): kink was bounded from the start, the three rate
/// legs were not. This contract is shared by every market, so one unbounded
/// call could have repriced all five at once.
contract InterestRateModelBoundsTest is Test {
    InterestRateModel irm;
    address owner = address(0xA11CE);

    function setUp() public {
        vm.prank(owner);
        irm = new InterestRateModel(0, 0.1e18, 3.0e18, 0.8e18, owner);
    }

    function test_RejectsBaseRateAboveCap() public {
        uint256 over = irm.MAX_RATE_PER_YEAR() + 1;
        vm.prank(owner);
        vm.expectRevert(InterestRateModel.InvalidRate.selector);
        irm.setParams(over, 0.1e18, 3e18, 0.8e18);
    }

    function test_RejectsMultiplierAboveCap() public {
        uint256 over = irm.MAX_RATE_PER_YEAR() + 1;
        vm.prank(owner);
        vm.expectRevert(InterestRateModel.InvalidRate.selector);
        irm.setParams(0, over, 3e18, 0.8e18);
    }

    function test_RejectsJumpMultiplierAboveCap() public {
        uint256 over = irm.MAX_RATE_PER_YEAR() + 1;
        vm.prank(owner);
        vm.expectRevert(InterestRateModel.InvalidRate.selector);
        irm.setParams(0, 0.1e18, over, 0.8e18);
    }

    function test_AcceptsExactlyTheCap() public {
        uint256 cap = irm.MAX_RATE_PER_YEAR();
        vm.prank(owner);
        irm.setParams(cap, cap, cap, 0.8e18);
        assertGt(irm.jumpMultiplierPerSecond(), 0);
    }

    function test_LiveParamsSitWellInsideTheCap() public view {
        // The deployed curve is 0 / 10% / 300%, all far below 1,000%.
        assertLe(3e18, irm.MAX_RATE_PER_YEAR());
    }

    function testFuzz_AnyAcceptedRateStaysFinite(uint256 base, uint256 mult, uint256 jump) public {
        base = bound(base, 0, irm.MAX_RATE_PER_YEAR());
        mult = bound(mult, 0, irm.MAX_RATE_PER_YEAR());
        jump = bound(jump, 0, irm.MAX_RATE_PER_YEAR());

        vm.prank(owner);
        irm.setParams(base, mult, jump, 0.8e18);

        // A full year at 100% utilization must not overflow.
        uint256 rate = irm.getBorrowRatePerSecond(0, 1_000_000e18);
        assertLt(rate * 365 days, type(uint256).max / 1e18, "rate * elapsed stays far from overflow");
    }
}
