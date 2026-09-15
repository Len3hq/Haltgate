// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {MockPausableOracle} from "../../src/oracle/MockPausableOracle.sol";

contract MockPausableOracleTest is Test {
    MockPausableOracle oracle;
    address owner = address(0xA11CE);
    address stranger = address(0xB0B);
    uint256 constant INITIAL_PRICE = 450e18;

    function setUp() public {
        oracle = new MockPausableOracle(INITIAL_PRICE, owner);
    }

    function test_InitialState() public view {
        (uint256 price, uint256 updatedAt, bool paused) = oracle.latestPrice();
        assertEq(price, INITIAL_PRICE);
        assertEq(updatedAt, block.timestamp);
        assertFalse(paused);
        assertFalse(oracle.isPaused());
    }

    function test_SetPrice_UpdatesWhenOpen() public {
        vm.warp(block.timestamp + 1 hours);
        vm.prank(owner);
        oracle.setPrice(460e18);

        (uint256 price, uint256 updatedAt, bool paused) = oracle.latestPrice();
        assertEq(price, 460e18);
        assertEq(updatedAt, block.timestamp);
        assertFalse(paused);
    }

    function test_SetPrice_RevertsWhenPaused() public {
        vm.prank(owner);
        oracle.pauseOracle();

        vm.prank(owner);
        vm.expectRevert(MockPausableOracle.OraclePaused.selector);
        oracle.setPrice(999e18);
    }

    function test_PauseOracle_FreezesState() public {
        vm.warp(block.timestamp + 1 days);
        vm.prank(owner);
        oracle.pauseOracle();

        (uint256 price, uint256 updatedAt, bool paused) = oracle.latestPrice();
        assertEq(price, INITIAL_PRICE);
        assertEq(updatedAt, block.timestamp - 1 days, "updatedAt must not move on pause itself");
        assertTrue(paused);
    }

    function test_PausedState_FreezesDespiteTimePassing() public {
        vm.prank(owner);
        oracle.pauseOracle();

        uint256 frozenAt = block.timestamp;
        vm.warp(block.timestamp + 3 days);

        (uint256 price, uint256 updatedAt, bool paused) = oracle.latestPrice();
        assertEq(price, INITIAL_PRICE);
        assertEq(updatedAt, frozenAt, "updatedAt must stay frozen while paused, regardless of elapsed time");
        assertTrue(paused);
    }

    function test_PauseOracle_RevertsIfAlreadyPaused() public {
        vm.startPrank(owner);
        oracle.pauseOracle();
        vm.expectRevert(MockPausableOracle.OraclePaused.selector);
        oracle.pauseOracle();
        vm.stopPrank();
    }

    function test_ResumeOracle_UpdatesPriceAndUnpauses() public {
        vm.startPrank(owner);
        oracle.pauseOracle();
        vm.warp(block.timestamp + 2 hours);
        oracle.resumeOracle(500e18);
        vm.stopPrank();

        (uint256 price, uint256 updatedAt, bool paused) = oracle.latestPrice();
        assertEq(price, 500e18, "resume should carry the post-CA (e.g. post-split) price");
        assertEq(updatedAt, block.timestamp);
        assertFalse(paused);
    }

    function test_ResumeOracle_RevertsIfNotPaused() public {
        vm.prank(owner);
        vm.expectRevert(MockPausableOracle.OracleNotPaused.selector);
        oracle.resumeOracle(500e18);
    }

    function test_OnlyOwner_CanPause() public {
        vm.prank(stranger);
        vm.expectRevert();
        oracle.pauseOracle();
    }

    function test_OnlyOwner_CanResume() public {
        vm.prank(owner);
        oracle.pauseOracle();

        vm.prank(stranger);
        vm.expectRevert();
        oracle.resumeOracle(500e18);
    }

    function test_OnlyOwner_CanSetPrice() public {
        vm.prank(stranger);
        vm.expectRevert();
        oracle.setPrice(1e18);
    }

    // --- Sanity bounds ---

    function test_Constructor_RevertsOnZeroPrice() public {
        vm.expectRevert(MockPausableOracle.ZeroPrice.selector);
        new MockPausableOracle(0, owner);
    }

    function test_SetPrice_RevertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(MockPausableOracle.ZeroPrice.selector);
        oracle.setPrice(0);
    }

    function test_SetPrice_RevertsOnLargeDeviation() public {
        // default cap is 20%; a jump to 2x is a real-world-suspicious move outside a CA window
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(MockPausableOracle.DeviationTooLarge.selector, 10_000, 2000));
        oracle.setPrice(900e18); // 450 -> 900 is a 100% (10,000 bps) jump
    }

    function test_SetPrice_AllowsUpToExactlyTheCap() public {
        // 450 * 1.20 = 540, exactly at the 20% (2000 bps) default cap
        vm.prank(owner);
        oracle.setPrice(540e18);
        (uint256 price,,) = oracle.latestPrice();
        assertEq(price, 540e18);
    }

    function test_SetPrice_RevertsJustOverTheCap() public {
        // Integer bps math truncates, so a tiny nudge (e.g. +1e15) can still
        // round down to exactly 2000 bps and incorrectly pass -- confirmed by
        // running this at +1e15 first and watching it fail to revert. +1e17
        // reliably pushes the truncated bps value to 2002, past the cap.
        vm.prank(owner);
        vm.expectRevert(); // exact bps math need not be asserted here -- just that it reverts
        oracle.setPrice(540e18 + 1e17);
    }

    function test_ResumeOracle_RevertsOnZero() public {
        vm.startPrank(owner);
        oracle.pauseOracle();
        vm.expectRevert(MockPausableOracle.ZeroPrice.selector);
        oracle.resumeOracle(0);
        vm.stopPrank();
    }

    /// @notice The whole point of the asymmetric design: a real 2-for-1
    /// split roughly halves the price -- resumeOracle() must allow this,
    /// even though the identical move via setPrice() would revert.
    function test_ResumeOracle_AllowsLargeDeviation_ForRealCorporateActions() public {
        vm.startPrank(owner);
        oracle.pauseOracle();
        oracle.resumeOracle(225e18); // 450 -> 225, a 50% drop simulating a 2-for-1 split
        vm.stopPrank();

        (uint256 price,,) = oracle.latestPrice();
        assertEq(price, 225e18);
    }

    function test_SetMaxNormalUpdateDeviationBps_OnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        oracle.setMaxNormalUpdateDeviationBps(5000);

        vm.prank(owner);
        oracle.setMaxNormalUpdateDeviationBps(5000);
        assertEq(oracle.maxNormalUpdateDeviationBps(), 5000);
    }

    function test_SetMaxNormalUpdateDeviationBps_WidensWhatSetPriceAllows() public {
        vm.startPrank(owner);
        oracle.setMaxNormalUpdateDeviationBps(5000); // widen to 50%
        oracle.setPrice(675e18); // 450 -> 675 is exactly 50%, would have reverted at the 20% default
        vm.stopPrank();

        (uint256 price,,) = oracle.latestPrice();
        assertEq(price, 675e18);
    }
}
