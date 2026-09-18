// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Market} from "../../src/core/Market.sol";
import {HaltController} from "../../src/core/HaltController.sol";
import {LenderVault} from "../../src/core/LenderVault.sol";
import {InterestRateModel} from "../../src/core/InterestRateModel.sol";
import {MockPausableOracle} from "../../src/oracle/MockPausableOracle.sol";
import {MockWrappedXStock} from "../../src/tokens/MockWrappedXStock.sol";
import {MockUSDG} from "../../src/tokens/MockUSDG.sol";

/// @notice Proves Market's independent oracle-freshness check actually
/// closes the gap it exists for: HaltController.sync() is permissionless
/// but still requires someone to call it. If nobody does after a real
/// corporate-action pause, the controller can report OPEN while the oracle
/// itself is paused -- these tests construct exactly that scenario directly
/// (not just via the happy-path integration test) and confirm Market still
/// refuses to trade against it.
contract MarketOracleFreshnessTest is Test {
    Market market;
    HaltController controller;
    LenderVault vault;
    InterestRateModel irm;
    MockPausableOracle oracle;
    MockWrappedXStock wNVDAx;
    MockUSDG usdg;

    address owner = address(0xA11CE);
    address keeper = address(0xCAFE);
    address alice = address(0xA11CE0);

    function setUp() public {
        vm.startPrank(owner);
        oracle = new MockPausableOracle(180e18, owner);
        wNVDAx = new MockWrappedXStock("Mock Wrapped NVIDIA xStock", "wNVDAx-MOCK", owner);
        usdg = new MockUSDG(owner, 18);
        controller = new HaltController(address(oracle), owner, keeper);
        vault = new LenderVault(address(usdg), owner);
        irm = new InterestRateModel(0, 0.1e18, 3.0e18, 0.8e18, owner);
        market = new Market(
            address(wNVDAx), address(usdg), address(oracle), address(controller), address(vault), address(irm), owner, 0.5e18, 0.55e18, 0
        );
        vault.setMarket(address(market));

        usdg.mint(owner, 100_000e18);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(100_000e18, owner);

        wNVDAx.mint(alice, 100e18);
        vm.stopPrank();

        vm.prank(alice);
        wNVDAx.approve(address(market), type(uint256).max);
        vm.prank(alice);
        usdg.approve(address(market), type(uint256).max);
    }

    /// @notice The exact gap this check exists to close: oracle paused, but
    /// sync() was never called, so the controller still (wrongly) reports OPEN.
    function test_Borrow_RevertsWhenOraclePaused_EvenIfControllerStillReportsOpen() public {
        vm.prank(alice);
        market.supply(10e18);

        vm.prank(owner);
        oracle.pauseOracle(); // real world: a corporate action just activated

        // Deliberately do NOT call controller.sync() -- simulating nobody noticing in time.
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.OPEN), "sanity: controller is stale");
        assertTrue(controller.canSupplyOrBorrow(), "sanity: controller-only gating would wrongly allow this");

        vm.prank(alice);
        vm.expectRevert(Market.OraclePausedDirectly.selector);
        market.borrow(500e18);
    }

    function test_Borrow_RevertsWhenPriceIsStale() public {
        vm.prank(alice);
        market.supply(10e18);

        vm.warp(block.timestamp + 25 hours); // past the 24h default, oracle never paused, just never updated

        vm.prank(alice);
        vm.expectRevert(); // exact staleness value isn't asserted here, just that it reverts
        market.borrow(500e18);
    }

    function test_Borrow_SucceedsExactlyAtStalenessBoundary() public {
        vm.prank(alice);
        market.supply(10e18);

        vm.warp(block.timestamp + 24 hours); // exactly at the boundary, not past it

        vm.prank(alice);
        market.borrow(500e18); // must not revert
    }

    function test_Borrow_SucceedsWhenFreshAndUnpaused() public {
        vm.prank(alice);
        market.supply(10e18);

        vm.prank(alice);
        market.borrow(500e18); // sanity: the check doesn't break the normal path
    }

    function test_Liquidate_RevertsWhenOraclePaused_EvenIfControllerStillReportsOpen() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(900e18);
        vm.stopPrank();

        vm.prank(owner);
        oracle.pauseOracle();
        // No sync() -- controller still (wrongly) reports OPEN, so
        // haltController.canLiquidate() alone would not catch this.

        vm.expectRevert(Market.OraclePausedDirectly.selector);
        market.liquidate(alice, 100e18);
    }

    function test_SetMaxOracleStaleness_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        market.setMaxOracleStaleness(1 hours);

        vm.prank(owner);
        market.setMaxOracleStaleness(1 hours);
        assertEq(market.maxOracleStaleness(), 1 hours);

        vm.prank(alice);
        market.supply(10e18);
        vm.warp(block.timestamp + 2 hours);

        vm.prank(alice);
        vm.expectRevert(); // now stale under the tightened window
        market.borrow(1e18);
    }
}
