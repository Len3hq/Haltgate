// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {HaltController} from "../../src/core/HaltController.sol";
import {MockPausableOracle} from "../../src/oracle/MockPausableOracle.sol";

contract HaltControllerTest is Test {
    HaltController controller;
    MockPausableOracle oracle;

    address owner = address(0xA11CE);
    address keeper = address(0xCAFE);
    address stranger = address(0xB0B);

    function setUp() public {
        oracle = new MockPausableOracle(450e18, owner);
        controller = new HaltController(address(oracle), owner, keeper);
    }

    function test_InitialState() public view {
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.OPEN));
        assertTrue(controller.canSupplyOrBorrow());
        assertTrue(controller.canLiquidate());
        assertTrue(controller.canRepay());
        assertFalse(controller.isHalted());
    }

    function test_Sync_OpenToHalted_WhenOraclePauses() public {
        vm.prank(owner);
        oracle.pauseOracle();

        controller.sync(); // permissionless

        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.HALTED));
        assertTrue(controller.isHalted());
        assertFalse(controller.canSupplyOrBorrow());
        assertFalse(controller.canLiquidate());
        assertTrue(controller.canRepay());
    }

    function test_Sync_HaltingToHalted_WhenOraclePauses() public {
        vm.prank(keeper);
        controller.beginHalting();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.HALTING));
        assertTrue(controller.isHalted(), "HALTING must count as halted for risk purposes");
        assertFalse(controller.canSupplyOrBorrow());

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();

        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.HALTED));
    }

    function test_Sync_HaltedToResuming_WhenOracleUnpauses() public {
        vm.startPrank(owner);
        oracle.pauseOracle();
        controller.sync();
        oracle.resumeOracle(500e18);
        vm.stopPrank();

        controller.sync();

        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.RESUMING));
        assertTrue(controller.canRepay());
        assertFalse(controller.canLiquidate(), "liquidations must wait until fully OPEN, even during RESUMING");
        assertFalse(controller.canSupplyOrBorrow());
    }

    function test_Sync_NoOp_WhenAlreadyMatchingOracle() public {
        controller.sync(); // oracle not paused, state already OPEN -- should stay OPEN
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.OPEN));
    }

    function test_Sync_IsPermissionless() public {
        vm.prank(owner);
        oracle.pauseOracle();

        vm.prank(stranger);
        controller.sync(); // anyone can call sync -- no revert expected

        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.HALTED));
    }

    function test_CompleteResume_RequiresResumingState() public {
        vm.prank(keeper);
        vm.expectRevert(
            abi.encodeWithSelector(
                HaltController.WrongState.selector, HaltController.MarketState.RESUMING, HaltController.MarketState.OPEN
            )
        );
        controller.completeResume();
    }

    function test_FullLifecycle() public {
        // OPEN -> HALTING (pre-warn ahead of known CA timing)
        vm.prank(keeper);
        controller.beginHalting();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.HALTING));

        // Oracle actually pauses at CA activation -> sync to HALTED
        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.HALTED));

        // Oracle resumes post-CA -> sync to RESUMING
        vm.prank(owner);
        oracle.resumeOracle(500e18);
        controller.sync();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.RESUMING));

        // Market verifies solvency, keeper completes the resume -> OPEN
        vm.prank(keeper);
        controller.completeResume();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.OPEN));
        assertTrue(controller.canSupplyOrBorrow());
        assertTrue(controller.canLiquidate());
    }

    function test_BeginHalting_OnlyFromOpen() public {
        vm.prank(keeper);
        controller.beginHalting();

        vm.prank(keeper);
        vm.expectRevert(
            abi.encodeWithSelector(
                HaltController.WrongState.selector, HaltController.MarketState.OPEN, HaltController.MarketState.HALTING
            )
        );
        controller.beginHalting();
    }

    function test_BeginHalting_OnlyKeeperOrOwner() public {
        vm.prank(stranger);
        vm.expectRevert(HaltController.NotAuthorized.selector);
        controller.beginHalting();
    }

    function test_ForceResume_OwnerOnly_AnyState() public {
        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.HALTED));

        vm.prank(stranger);
        vm.expectRevert();
        controller.forceResume("stranger cannot force resume");

        vm.prank(owner);
        controller.forceResume("multisig emergency override");
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.OPEN));
    }

    function test_SetKeeper_OnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        controller.setKeeper(stranger);

        vm.prank(owner);
        controller.setKeeper(stranger);
        assertEq(controller.keeper(), stranger);
    }

    function test_SetKeeper_RevertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(HaltController.ZeroAddress.selector);
        controller.setKeeper(address(0));
    }

    function test_Constructor_RevertsOnZeroKeeper() public {
        vm.expectRevert(HaltController.ZeroAddress.selector);
        new HaltController(address(oracle), owner, address(0));
    }

    function test_Constructor_RevertsOnZeroOracle() public {
        vm.expectRevert(HaltController.ZeroAddress.selector);
        new HaltController(address(0), owner, keeper);
    }
}
