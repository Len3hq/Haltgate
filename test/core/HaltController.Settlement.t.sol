// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {HaltController} from "../../src/core/HaltController.sol";
import {MockPausableOracle} from "../../src/oracle/MockPausableOracle.sol";

/// @notice Covers the terminal-halt settlement path: a halt that never
/// resolves must not strand lender capital forever. The state machine side
/// lives here; the pro-rata redemption it unlocks is covered in
/// LenderVault.Settlement.t.sol.
contract HaltControllerSettlementTest is Test {
    HaltController controller;
    MockPausableOracle oracle;

    address owner = address(0xA11CE);
    address keeper = address(0xCAFE);
    address stranger = address(0xBEEF);

    function setUp() public {
        vm.startPrank(owner);
        oracle = new MockPausableOracle(180e18, owner);
        controller = new HaltController(address(oracle), owner, keeper);
        vm.stopPrank();
    }

    function _halt() internal {
        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();
    }

    // --- The clock --------------------------------------------------------

    function test_ClockIsUnsetWhileOpen() public view {
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.OPEN));
        assertEq(controller.haltStartedAt(), 0);
        assertEq(controller.settlementAvailableAt(), 0);
    }

    function test_ClockStartsWhenMarketLeavesOpen() public {
        uint256 t = block.timestamp;
        _halt();
        assertEq(controller.haltStartedAt(), t);
        assertEq(controller.settlementAvailableAt(), t + controller.settlementDelay());
    }

    function test_ClockStartsOnHalting_NotJustHalted() public {
        // HALTING restricts capital too, so it has to start the clock --
        // otherwise a market parked in HALTING never becomes settleable.
        uint256 t = block.timestamp;
        vm.prank(keeper);
        controller.beginHalting();
        assertEq(controller.haltStartedAt(), t);
    }

    function test_ClockDoesNotRestartAcrossPhaseTransitions() public {
        uint256 t = block.timestamp;
        vm.prank(keeper);
        controller.beginHalting();

        vm.warp(t + 2 days);
        _halt(); // HALTING -> HALTED

        vm.warp(t + 3 days);
        vm.prank(owner);
        oracle.resumeOracle(180e18);
        controller.sync(); // HALTED -> RESUMING

        // Still measured from the original departure from OPEN. Restarting
        // per-phase would let a market cycle forever and never settle.
        assertEq(controller.haltStartedAt(), t);
    }

    function test_ClockClearsOnReturnToOpen() public {
        _halt();
        assertGt(controller.haltStartedAt(), 0);

        vm.prank(owner);
        oracle.resumeOracle(180e18);
        controller.sync();
        vm.prank(keeper);
        controller.completeResume();

        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.OPEN));
        assertEq(controller.haltStartedAt(), 0);
    }

    // --- forceSettle ------------------------------------------------------

    function test_ForceSettle_RevertsBeforeDurationElapses() public {
        _halt();
        uint256 settleableAt = controller.settlementAvailableAt();

        vm.warp(settleableAt - 1);
        vm.expectRevert(abi.encodeWithSelector(HaltController.HaltTooRecent.selector, settleableAt));
        controller.forceSettle();
    }

    function test_ForceSettle_SucceedsExactlyAtBoundary() public {
        _halt();
        vm.warp(controller.settlementAvailableAt());
        controller.forceSettle();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.SETTLING));
    }

    function test_ForceSettle_IsPermissionless() public {
        // The whole point: a guarantee that depends on the same governance
        // that let the market get stuck isn't a guarantee.
        _halt();
        vm.warp(block.timestamp + 8 days);

        vm.prank(stranger);
        controller.forceSettle();
        assertTrue(controller.isSettling());
    }

    function test_ForceSettle_RevertsWhenOpen() public {
        vm.expectRevert(HaltController.NotSettleable.selector);
        controller.forceSettle();
    }

    function test_ForceSettle_RevertsWhenAlreadySettling() public {
        _halt();
        vm.warp(block.timestamp + 8 days);
        controller.forceSettle();

        vm.expectRevert(HaltController.NotSettleable.selector);
        controller.forceSettle();
    }

    function test_ForceSettle_WorksFromHalting() public {
        vm.prank(keeper);
        controller.beginHalting();
        vm.warp(block.timestamp + 8 days);

        controller.forceSettle();
        assertTrue(controller.isSettling());
    }

    function test_ForceSettle_WorksFromResuming_KeeperNeverCompleted() public {
        // A keeper that goes silent mid-resume strands capital just as
        // effectively as an oracle that never unpauses.
        _halt();
        vm.prank(owner);
        oracle.resumeOracle(180e18);
        controller.sync();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.RESUMING));

        vm.warp(block.timestamp + 8 days);
        controller.forceSettle();
        assertTrue(controller.isSettling());
    }

    // --- Settlement is a release valve, not a dead end -------------------

    function test_Sync_DoesNotDragSettlingBackToHalted() public {
        _halt();
        vm.warp(block.timestamp + 8 days);
        controller.forceSettle();

        // Oracle is still paused. Anyone calling sync() must not be able to
        // re-freeze the capital settlement just released.
        controller.sync();
        assertTrue(controller.isSettling());
    }

    function test_Sync_MovesSettlingToResumingOnceOracleRecovers() public {
        _halt();
        vm.warp(block.timestamp + 8 days);
        controller.forceSettle();

        vm.prank(owner);
        oracle.resumeOracle(180e18);
        controller.sync();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.RESUMING));

        vm.prank(keeper);
        controller.completeResume();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.OPEN));
        assertEq(controller.haltStartedAt(), 0, "clock cleared on full recovery");
    }

    // --- Settling still blocks everything risky ---------------------------

    function test_Settling_BlocksSupplyBorrowAndLiquidation() public {
        _halt();
        vm.warp(block.timestamp + 8 days);
        controller.forceSettle();

        assertFalse(controller.canSupplyOrBorrow(), "no new risk while the price is still unresolved");
        assertFalse(controller.canLiquidate(), "liquidation stays off -- the price can't be trusted");
        assertTrue(controller.canRepay(), "repay always allowed, it only reduces risk");
        assertTrue(controller.interestFrozen(), "debt stops growing, same reason as during a halt");
    }

    // --- Governance bounds ------------------------------------------------

    function test_SetSettlementDelay_RevertsBelowFloor() public {
        uint256 tooShort = controller.MIN_SETTLEMENT_DELAY() - 1;
        vm.prank(owner);
        vm.expectRevert(HaltController.InvalidSettlementDelay.selector);
        controller.setSettlementDelay(tooShort);
    }

    function test_SetSettlementDelay_RevertsAboveCeiling() public {
        uint256 tooLong = controller.MAX_SETTLEMENT_DELAY() + 1;
        vm.prank(owner);
        vm.expectRevert(HaltController.InvalidSettlementDelay.selector);
        controller.setSettlementDelay(tooLong);
    }

    function test_SetSettlementDelay_OnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        controller.setSettlementDelay(2 days);
    }

    function test_SetSettlementDelay_AppliesToRunningClock() public {
        _halt();
        uint256 startedAt = controller.haltStartedAt();

        vm.prank(owner);
        controller.setSettlementDelay(2 days);
        assertEq(controller.settlementAvailableAt(), startedAt + 2 days);

        vm.warp(startedAt + 2 days);
        controller.forceSettle();
        assertTrue(controller.isSettling());
    }

    function test_GovernanceCannotRevokeSettlementByPushingDurationOut() public {
        // The ceiling is what makes settlement a guarantee rather than a
        // courtesy -- without it, governance could restore the indefinite
        // lockup just by setting an absurd duration.
        _halt();
        vm.prank(owner);
        vm.expectRevert(HaltController.InvalidSettlementDelay.selector);
        controller.setSettlementDelay(3650 days);

        vm.warp(block.timestamp + controller.MAX_SETTLEMENT_DELAY() + 1);
        controller.forceSettle();
        assertTrue(controller.isSettling(), "settleable no matter what governance wanted");
    }
}
