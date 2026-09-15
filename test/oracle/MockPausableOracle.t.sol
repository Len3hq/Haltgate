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
}
