// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Multisig} from "../../src/governance/Multisig.sol";

contract Target {
    uint256 public value;
    address public lastCaller;

    function setValue(uint256 newValue) external {
        value = newValue;
        lastCaller = msg.sender;
    }

    function alwaysReverts() external pure {
        revert("nope");
    }

    receive() external payable {}
}

contract MultisigTest is Test {
    Multisig ms;
    Target target;

    address signer1 = address(0x1);
    address signer2 = address(0x2);
    address signer3 = address(0x3);
    address stranger = address(0xB0B);

    function setUp() public {
        address[] memory signers = new address[](3);
        signers[0] = signer1;
        signers[1] = signer2;
        signers[2] = signer3;
        ms = new Multisig(signers, 2); // 2-of-3
        target = new Target();
    }

    function test_InitialState() public view {
        assertEq(ms.threshold(), 2);
        assertEq(ms.signerCount(), 3);
        assertTrue(ms.isSigner(signer1));
        assertTrue(ms.isSigner(signer2));
        assertTrue(ms.isSigner(signer3));
        assertFalse(ms.isSigner(stranger));
    }

    function test_Constructor_RevertsOnZeroThreshold() public {
        address[] memory signers = new address[](1);
        signers[0] = signer1;
        vm.expectRevert(Multisig.InvalidThreshold.selector);
        new Multisig(signers, 0);
    }

    function test_Constructor_RevertsOnThresholdAboveSignerCount() public {
        address[] memory signers = new address[](2);
        signers[0] = signer1;
        signers[1] = signer2;
        vm.expectRevert(Multisig.InvalidThreshold.selector);
        new Multisig(signers, 3);
    }

    function test_Constructor_RevertsOnDuplicateSigner() public {
        address[] memory signers = new address[](2);
        signers[0] = signer1;
        signers[1] = signer1;
        vm.expectRevert(Multisig.DuplicateSigner.selector);
        new Multisig(signers, 1);
    }

    function test_Constructor_RevertsOnZeroAddressSigner() public {
        address[] memory signers = new address[](2);
        signers[0] = signer1;
        signers[1] = address(0);
        vm.expectRevert(Multisig.ZeroAddress.selector);
        new Multisig(signers, 1);
    }

    function test_Propose_AutoConfirmsFromProposer() public {
        vm.prank(signer1);
        uint256 txId = ms.propose(address(target), 0, abi.encodeCall(Target.setValue, (42)));

        (,,, bool executed, uint256 confirmations) = ms.transactions(txId);
        assertFalse(executed);
        assertEq(confirmations, 1);
        assertTrue(ms.hasConfirmed(txId, signer1));
    }

    function test_Propose_OnlySigner() public {
        vm.prank(stranger);
        vm.expectRevert(Multisig.NotSigner.selector);
        ms.propose(address(target), 0, "");
    }

    function test_Execute_RevertsBelowThreshold() public {
        vm.prank(signer1);
        uint256 txId = ms.propose(address(target), 0, abi.encodeCall(Target.setValue, (42)));

        vm.prank(signer1);
        vm.expectRevert(Multisig.InsufficientConfirmations.selector);
        ms.execute(txId);
    }

    function test_Execute_SucceedsAtThreshold() public {
        vm.prank(signer1);
        uint256 txId = ms.propose(address(target), 0, abi.encodeCall(Target.setValue, (42)));

        vm.prank(signer2);
        ms.confirm(txId);

        vm.prank(signer1);
        ms.execute(txId);

        assertEq(target.value(), 42);
        assertEq(target.lastCaller(), address(ms));

        (,,, bool executed,) = ms.transactions(txId);
        assertTrue(executed);
    }

    function test_Execute_RevertsIfAlreadyExecuted() public {
        vm.prank(signer1);
        uint256 txId = ms.propose(address(target), 0, abi.encodeCall(Target.setValue, (42)));
        vm.prank(signer2);
        ms.confirm(txId);
        vm.prank(signer1);
        ms.execute(txId);

        vm.prank(signer1);
        vm.expectRevert(Multisig.AlreadyExecuted.selector);
        ms.execute(txId);
    }

    function test_Confirm_RevertsOnDoubleConfirm() public {
        vm.prank(signer1);
        uint256 txId = ms.propose(address(target), 0, "");

        vm.prank(signer1);
        vm.expectRevert(Multisig.AlreadyConfirmed.selector);
        ms.confirm(txId);
    }

    function test_RevokeConfirmation() public {
        vm.prank(signer1);
        uint256 txId = ms.propose(address(target), 0, abi.encodeCall(Target.setValue, (42)));
        vm.prank(signer2);
        ms.confirm(txId);

        vm.prank(signer2);
        ms.revokeConfirmation(txId);

        (,,,, uint256 confirmations) = ms.transactions(txId);
        assertEq(confirmations, 1);

        vm.prank(signer1);
        vm.expectRevert(Multisig.InsufficientConfirmations.selector);
        ms.execute(txId);
    }

    function test_RevokeConfirmation_RevertsIfNeverConfirmed() public {
        vm.prank(signer1);
        uint256 txId = ms.propose(address(target), 0, "");

        vm.prank(signer2);
        vm.expectRevert(Multisig.NotConfirmed.selector);
        ms.revokeConfirmation(txId);
    }

    function test_Execute_PropagatesTargetRevert() public {
        vm.prank(signer1);
        uint256 txId = ms.propose(address(target), 0, abi.encodeCall(Target.alwaysReverts, ()));
        vm.prank(signer2);
        ms.confirm(txId);

        vm.prank(signer1);
        vm.expectRevert(); // ExecutionFailed wrapping the target's revert reason
        ms.execute(txId);
    }

    // --- Self-governance: signer/threshold changes must go through the multisig itself ---

    function test_AddSigner_OnlyViaExecute() public {
        vm.prank(signer1);
        vm.expectRevert(Multisig.OnlySelf.selector);
        ms.addSigner(stranger);

        address newSigner = address(0x4);
        vm.prank(signer1);
        uint256 txId = ms.propose(address(ms), 0, abi.encodeCall(Multisig.addSigner, (newSigner)));
        vm.prank(signer2);
        ms.confirm(txId);
        vm.prank(signer1);
        ms.execute(txId);

        assertTrue(ms.isSigner(newSigner));
        assertEq(ms.signerCount(), 4);
    }

    function test_RemoveSigner_RevertsIfWouldDropBelowThreshold() public {
        // 2-of-3: removing down to 2 signers with threshold 2 is fine, but
        // this test targets the boundary via a temporary change to prove
        // the guard fires when it should.
        vm.prank(signer1);
        uint256 raiseTx = ms.propose(address(ms), 0, abi.encodeCall(Multisig.changeThreshold, (3)));
        vm.prank(signer2);
        ms.confirm(raiseTx);
        vm.prank(signer1);
        ms.execute(raiseTx);
        assertEq(ms.threshold(), 3);

        // Threshold is now 3, so this proposal itself needs all 3
        // confirmations before execute() will even attempt the inner call.
        vm.prank(signer1);
        uint256 removeTx = ms.propose(address(ms), 0, abi.encodeCall(Multisig.removeSigner, (signer3)));
        vm.prank(signer2);
        ms.confirm(removeTx);
        vm.prank(signer3);
        ms.confirm(removeTx);

        vm.prank(signer1);
        vm.expectRevert(); // ExecutionFailed wraps the inner InvalidThreshold revert; selector-only match isn't exact here
        ms.execute(removeTx);
    }

    function test_ChangeThreshold_OnlyViaExecute() public {
        vm.prank(signer1);
        vm.expectRevert(Multisig.OnlySelf.selector);
        ms.changeThreshold(1);
    }

    function test_Multisig_CanHoldAndForwardValue() public {
        vm.deal(address(ms), 1 ether);

        vm.prank(signer1);
        uint256 txId = ms.propose(address(target), 0.5 ether, "");
        vm.prank(signer2);
        ms.confirm(txId);

        uint256 targetBalanceBefore = address(target).balance;
        vm.prank(signer1);
        ms.execute(txId);

        assertEq(address(target).balance, targetBalanceBefore + 0.5 ether);
    }
}
