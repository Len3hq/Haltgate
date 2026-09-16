// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Multisig} from "../../src/governance/Multisig.sol";
import {Market} from "../../src/core/Market.sol";
import {HaltController} from "../../src/core/HaltController.sol";
import {LenderVault} from "../../src/core/LenderVault.sol";
import {InterestRateModel} from "../../src/core/InterestRateModel.sol";
import {MockPausableOracle} from "../../src/oracle/MockPausableOracle.sol";
import {MockWrappedXStock} from "../../src/tokens/MockWrappedXStock.sol";
import {MockUSDG} from "../../src/tokens/MockUSDG.sol";

/// @notice Proves the full governance stack: multisig (agreement) as sole
/// proposer behind a TimelockController (mandatory delay), which in turn
/// owns Market -- two independent properties layered, neither able to
/// bypass the other. admin is disabled at construction (address(0)), so
/// there is no bypass role anywhere in the stack -- confirmed directly
/// against the installed OZ TimelockController source before building this.
contract MultisigTimelockIntegrationTest is Test {
    Multisig ms;
    TimelockController timelock;
    Market market;
    HaltController controller;
    LenderVault vault;
    InterestRateModel irm;
    MockPausableOracle oracle;
    MockWrappedXStock wNVDAx;
    MockUSDG usdg;

    address deployer = address(0xD00D);
    address signer1 = address(0x1);
    address signer2 = address(0x2);
    address signer3 = address(0x3);
    address rando = address(0xBEEF); // proves execution is genuinely open to anyone

    uint256 constant MIN_DELAY = 2 days;

    function setUp() public {
        vm.startPrank(deployer);
        oracle = new MockPausableOracle(180e18, deployer);
        wNVDAx = new MockWrappedXStock(deployer);
        usdg = new MockUSDG(deployer, 18);
        controller = new HaltController(address(oracle), deployer, deployer);
        vault = new LenderVault(address(usdg), deployer);
        irm = new InterestRateModel(0, 0.1e18, 3.0e18, 0.8e18, deployer);
        market = new Market(
            address(wNVDAx), address(usdg), address(oracle), address(controller), address(vault), address(irm), deployer, 0.5e18, 0.55e18, 0
        );
        vault.setMarket(address(market));

        address[] memory signers = new address[](3);
        signers[0] = signer1;
        signers[1] = signer2;
        signers[2] = signer3;
        ms = new Multisig(signers, 2);

        address[] memory proposers = new address[](1);
        proposers[0] = address(ms);
        address[] memory executors = new address[](1);
        executors[0] = address(0); // open execution once ready
        timelock = new TimelockController(MIN_DELAY, proposers, executors, address(0)); // no admin bypass

        market.transferOwnership(address(timelock));
        vm.stopPrank();
    }

    function test_StackWiredCorrectly() public view {
        assertEq(market.owner(), address(timelock));
        assertTrue(timelock.hasRole(timelock.PROPOSER_ROLE(), address(ms)));
        assertTrue(timelock.hasRole(timelock.EXECUTOR_ROLE(), address(0)));
        assertFalse(timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), deployer), "no admin bypass for anyone");
        assertFalse(timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), address(ms)));
    }

    function test_MultisigAlone_CannotBypassTimelockDelay() public {
        bytes memory setRiskParamsCall = abi.encodeCall(Market.setRiskParams, (0.4e18, 0.45e18));

        // Multisig can schedule, but scheduling != executing -- confirm the
        // real change hasn't happened yet even with 2-of-3 agreement.
        bytes memory scheduleCall = abi.encodeCall(
            TimelockController.schedule, (address(market), 0, setRiskParamsCall, bytes32(0), bytes32(0), MIN_DELAY)
        );
        vm.prank(signer1);
        uint256 txId = ms.propose(address(timelock), 0, scheduleCall);
        vm.prank(signer2);
        ms.confirm(txId);
        vm.prank(signer1);
        ms.execute(txId);

        assertEq(market.maxLTV(), 0.5e18, "market must be unchanged -- only scheduled, not executed");
    }

    function test_CannotExecuteBeforeDelayElapses() public {
        bytes memory setRiskParamsCall = abi.encodeCall(Market.setRiskParams, (0.4e18, 0.45e18));
        _scheduleViaMultisig(setRiskParamsCall);

        vm.warp(block.timestamp + MIN_DELAY - 1 hours); // not yet ready

        vm.prank(rando);
        vm.expectRevert(); // TimelockUnexpectedOperationState
        timelock.execute(address(market), 0, setRiskParamsCall, bytes32(0), bytes32(0));
    }

    function test_AnyoneCanExecute_OnceDelayElapses() public {
        bytes memory setRiskParamsCall = abi.encodeCall(Market.setRiskParams, (0.4e18, 0.45e18));
        _scheduleViaMultisig(setRiskParamsCall);

        vm.warp(block.timestamp + MIN_DELAY);

        vm.prank(rando); // not a signer, not privileged in any way
        timelock.execute(address(market), 0, setRiskParamsCall, bytes32(0), bytes32(0));

        assertEq(market.maxLTV(), 0.4e18);
        assertEq(market.liquidationThreshold(), 0.45e18);
    }

    function test_NonProposer_CannotSchedule() public {
        bytes memory setRiskParamsCall = abi.encodeCall(Market.setRiskParams, (0.4e18, 0.45e18));
        vm.prank(rando);
        vm.expectRevert(); // rando lacks PROPOSER_ROLE
        timelock.schedule(address(market), 0, setRiskParamsCall, bytes32(0), bytes32(0), MIN_DELAY);
    }

    function test_SingleMultisigSigner_CannotScheduleAlone() public {
        bytes memory setRiskParamsCall = abi.encodeCall(Market.setRiskParams, (0.4e18, 0.45e18));
        bytes memory scheduleCall = abi.encodeCall(
            TimelockController.schedule, (address(market), 0, setRiskParamsCall, bytes32(0), bytes32(0), MIN_DELAY)
        );
        vm.prank(signer1);
        uint256 txId = ms.propose(address(timelock), 0, scheduleCall);

        vm.prank(signer1);
        vm.expectRevert(Multisig.InsufficientConfirmations.selector);
        ms.execute(txId); // only 1 of 3 confirmations
    }

    function _scheduleViaMultisig(bytes memory targetCall) internal {
        bytes memory scheduleCall = abi.encodeCall(
            TimelockController.schedule, (address(market), 0, targetCall, bytes32(0), bytes32(0), MIN_DELAY)
        );
        vm.prank(signer1);
        uint256 txId = ms.propose(address(timelock), 0, scheduleCall);
        vm.prank(signer2);
        ms.confirm(txId);
        vm.prank(signer1);
        ms.execute(txId);
    }
}
