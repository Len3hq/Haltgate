// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Multisig} from "../../src/governance/Multisig.sol";
import {Market} from "../../src/core/Market.sol";
import {HaltController} from "../../src/core/HaltController.sol";
import {LenderVault} from "../../src/core/LenderVault.sol";
import {InterestRateModel} from "../../src/core/InterestRateModel.sol";
import {MockPausableOracle} from "../../src/oracle/MockPausableOracle.sol";
import {MockWrappedXStock} from "../../src/tokens/MockWrappedXStock.sol";
import {MockUSDG} from "../../src/tokens/MockUSDG.sol";

/// @notice Proves the multisig can actually govern the real system, not
/// just an abstract test target: ownership of Market transferred to a 2-of-3
/// multisig, and a genuine privileged action (setRiskParams) only goes
/// through with real multi-party agreement.
contract MultisigMarketIntegrationTest is Test {
    Multisig ms;
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

        market.transferOwnership(address(ms));
        vm.stopPrank();
    }

    function test_OwnershipActuallyTransferred() public view {
        assertEq(market.owner(), address(ms));
    }

    function test_DeployerCanNoLongerActDirectly() public {
        vm.prank(deployer);
        vm.expectRevert(); // Ownable: deployer is no longer the owner
        market.setRiskParams(0.4e18, 0.45e18);
    }

    function test_SingleSignerCannotActAlone() public {
        vm.prank(signer1);
        uint256 txId = ms.propose(address(market), 0, abi.encodeCall(Market.setRiskParams, (0.4e18, 0.45e18)));

        // Only 1 of 3 confirmations so far -- must not be enough for a 2-of-3.
        vm.prank(signer1);
        vm.expectRevert(Multisig.InsufficientConfirmations.selector);
        ms.execute(txId);

        // Market's risk params must be unchanged.
        assertEq(market.maxLTV(), 0.5e18);
    }

    function test_TwoOfThreeSigners_CanChangeRiskParams() public {
        vm.prank(signer1);
        uint256 txId = ms.propose(address(market), 0, abi.encodeCall(Market.setRiskParams, (0.4e18, 0.45e18)));
        vm.prank(signer2);
        ms.confirm(txId);

        vm.prank(signer1);
        ms.execute(txId);

        assertEq(market.maxLTV(), 0.4e18);
        assertEq(market.liquidationThreshold(), 0.45e18);
    }

    function test_MultisigOwnership_SurvivesAcrossHaltControllerToo() public {
        // The same pattern applies to HaltController -- transfer its
        // ownership too and confirm the multisig governs it as well.
        vm.prank(deployer);
        controller.transferOwnership(address(ms));

        vm.prank(signer1);
        uint256 txId = ms.propose(address(controller), 0, abi.encodeCall(HaltController.setKeeper, (signer3)));
        vm.prank(signer2);
        ms.confirm(txId);
        vm.prank(signer1);
        ms.execute(txId);

        assertEq(controller.keeper(), signer3);
    }
}
