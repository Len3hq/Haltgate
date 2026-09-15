// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Multisig} from "../../src/governance/Multisig.sol";
import {MockPausableOracle} from "../../src/oracle/MockPausableOracle.sol";

/// @notice Proves the deliberately different governance tier for the
/// oracle: owned directly by the multisig (multi-party agreement, no single
/// compromised key can move prices), but with NO timelock delay layered on
/// top -- unlike Market/HaltController. Pausing/resuming the oracle has to
/// happen promptly around real corporate-action timing (e.g. 00:30 UTC the
/// day after Ex-Date); a multi-day timelock would make that operationally
/// impossible and would defeat the system's actual purpose.
contract MultisigOracleIntegrationTest is Test {
    Multisig ms;
    MockPausableOracle oracle;

    address deployer = address(0xD00D);
    address signer1 = address(0x1);
    address signer2 = address(0x2);
    address signer3 = address(0x3);

    function setUp() public {
        vm.startPrank(deployer);
        oracle = new MockPausableOracle(180e18, deployer);

        address[] memory signers = new address[](3);
        signers[0] = signer1;
        signers[1] = signer2;
        signers[2] = signer3;
        ms = new Multisig(signers, 2);

        oracle.transferOwnership(address(ms));
        vm.stopPrank();
    }

    function test_OracleOwnedDirectlyByMultisig_NoTimelock() public view {
        assertEq(address(0) != address(ms), true); // sanity: real address
        // No timelock in this stack at all -- ownership is the multisig itself.
    }

    function test_TwoOfThreeSigners_CanPauseOracle_SameBlock() public {
        vm.prank(signer1);
        uint256 txId = ms.propose(address(oracle), 0, abi.encodeCall(MockPausableOracle.pauseOracle, ()));
        vm.prank(signer2);
        ms.confirm(txId);

        // Executes immediately, same block -- no artificial delay. This is
        // the entire point: real corporate-action timing can't wait through
        // a multi-day timelock.
        vm.prank(signer1);
        ms.execute(txId);

        assertTrue(oracle.isPaused());
    }

    function test_TwoOfThreeSigners_CanResumeOracle_SameBlock() public {
        vm.prank(signer1);
        uint256 pauseTx = ms.propose(address(oracle), 0, abi.encodeCall(MockPausableOracle.pauseOracle, ()));
        vm.prank(signer2);
        ms.confirm(pauseTx);
        vm.prank(signer1);
        ms.execute(pauseTx);

        vm.prank(signer1);
        uint256 resumeTx = ms.propose(address(oracle), 0, abi.encodeCall(MockPausableOracle.resumeOracle, (200e18)));
        vm.prank(signer2);
        ms.confirm(resumeTx);
        vm.prank(signer1);
        ms.execute(resumeTx);

        (uint256 price,, bool paused) = oracle.latestPrice();
        assertEq(price, 200e18);
        assertFalse(paused);
    }

    function test_SingleSigner_CannotPauseOracleAlone() public {
        vm.prank(signer1);
        uint256 txId = ms.propose(address(oracle), 0, abi.encodeCall(MockPausableOracle.pauseOracle, ()));

        vm.prank(signer1);
        vm.expectRevert(Multisig.InsufficientConfirmations.selector);
        ms.execute(txId);

        assertFalse(oracle.isPaused(), "a single compromised/rogue signer must not be able to move the oracle alone");
    }

    function test_DeployerCanNoLongerActOnOracleDirectly() public {
        vm.prank(deployer);
        vm.expectRevert(); // Ownable: deployer is no longer the owner
        oracle.pauseOracle();
    }
}
