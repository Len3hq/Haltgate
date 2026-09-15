// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Market} from "../../src/core/Market.sol";
import {HaltController} from "../../src/core/HaltController.sol";
import {MockPausableOracle} from "../../src/oracle/MockPausableOracle.sol";
import {MockWrappedXStock} from "../../src/tokens/MockWrappedXStock.sol";
import {MockUSDG} from "../../src/tokens/MockUSDG.sol";

/// @notice End-to-end simulation of a real xStocks corporate-action window
/// (e.g. a stock split) across multiple users, exercising oracle, controller,
/// and market together -- this is the scenario the whole project exists to
/// get right, and doubles as the logic behind the demo walkthrough.
contract CorporateActionLifecycleTest is Test {
    Market market;
    HaltController controller;
    MockPausableOracle oracle;
    MockWrappedXStock wNVDAx;
    MockUSDG usdg;

    address owner = address(0xA11CE);
    address keeper = address(0xCAFE);
    address alice = address(0x1); // borrows aggressively, near max LTV
    address bob = address(0x2); // borrows conservatively
    address liquidator = address(0xD00D);

    uint256 constant PRE_CA_PRICE = 180e18;
    uint256 constant MAX_LTV = 0.5e18;
    uint256 constant LIQ_THRESHOLD = 0.55e18;

    function setUp() public {
        vm.startPrank(owner);
        oracle = new MockPausableOracle(PRE_CA_PRICE, owner);
        wNVDAx = new MockWrappedXStock(owner);
        usdg = new MockUSDG(owner, 18);
        controller = new HaltController(address(oracle), owner, keeper);
        market = new Market(
            address(wNVDAx), address(usdg), address(oracle), address(controller), owner, MAX_LTV, LIQ_THRESHOLD
        );

        usdg.mint(owner, 1_000_000e18);
        usdg.approve(address(market), type(uint256).max);
        market.fundMarket(1_000_000e18);

        wNVDAx.mint(alice, 100e18);
        wNVDAx.mint(bob, 100e18);
        usdg.mint(liquidator, 100_000e18);
        vm.stopPrank();

        vm.startPrank(alice);
        wNVDAx.approve(address(market), type(uint256).max);
        usdg.approve(address(market), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        wNVDAx.approve(address(market), type(uint256).max);
        usdg.approve(address(market), type(uint256).max);
        vm.stopPrank();

        vm.prank(liquidator);
        usdg.approve(address(market), type(uint256).max);
    }

    function test_FullCorporateActionLifecycle() public {
        // --- Pre-CA: normal operation ---
        vm.startPrank(alice);
        market.supply(10e18); // value 1800
        market.borrow(900e18); // exactly maxLTV -- aggressive
        vm.stopPrank();

        vm.startPrank(bob);
        market.supply(10e18); // value 1800
        market.borrow(300e18); // conservative
        vm.stopPrank();

        assertFalse(market.isLiquidatable(alice));
        assertFalse(market.isLiquidatable(bob));
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.OPEN));

        // --- Pre-warn ahead of known CA activation timing ---
        vm.prank(keeper);
        controller.beginHalting();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.HALTING));

        vm.prank(alice);
        vm.expectRevert(Market.MarketHalted.selector);
        market.supply(1e18);

        vm.prank(bob);
        vm.expectRevert(Market.MarketHalted.selector);
        market.borrow(1e18);

        // Repay still works during the pre-warn window -- risk reduction is never blocked.
        vm.prank(bob);
        market.repay(50e18);
        (, uint256 bobDebt) = market.positions(bob);
        assertEq(bobDebt, 250e18);

        // --- CA activates: oracle actually pauses ---
        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.HALTED));

        vm.prank(liquidator);
        vm.expectRevert(Market.MarketHalted.selector);
        market.liquidate(alice, 100e18);

        // --- CA resolves: a split roughly halves the per-token price ---
        vm.prank(owner);
        oracle.resumeOracle(90e18);
        controller.sync();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.RESUMING));

        // Alice's 900 debt against now-900-value collateral is underwater at the 55% liq threshold; Bob is fine.
        assertTrue(market.isLiquidatable(alice));
        assertFalse(market.isLiquidatable(bob), "bob's conservative position should survive the split");

        // Liquidation still blocked mid-RESUMING, even though alice is liquidatable on paper.
        vm.prank(liquidator);
        vm.expectRevert(Market.MarketHalted.selector);
        market.liquidate(alice, 100e18);

        // --- Keeper verifies solvency and completes the resume ---
        vm.prank(keeper);
        controller.completeResume();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.OPEN));

        // --- Post-resume: liquidation now succeeds, normal operation resumes for everyone else ---
        vm.prank(liquidator);
        market.liquidate(alice, 100e18);
        (, uint256 aliceDebtAfter) = market.positions(alice);
        assertEq(aliceDebtAfter, 800e18);

        vm.prank(bob);
        market.borrow(50e18); // bob can operate normally again
        (, uint256 bobDebtAfter) = market.positions(bob);
        assertEq(bobDebtAfter, 300e18);
    }

    function test_ForceResume_SkipsNormalFlow_ForEmergencyOnly() public {
        vm.prank(alice);
        market.supply(10e18);

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.HALTED));

        vm.prank(keeper);
        vm.expectRevert(); // keeper cannot force-resume, only owner can
        controller.forceResume("attempted keeper override");

        // forceResume() only fixes HaltController's own bookkeeping -- it has
        // no access to the oracle, which is a separate contract. If the oracle
        // itself is still paused, Market's independent freshness check must
        // still block trading regardless of what the controller now reports.
        vm.prank(owner);
        controller.forceResume("controller bookkeeping stuck, oracle not yet independently verified");
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.OPEN));

        vm.prank(alice);
        vm.expectRevert(Market.OraclePausedDirectly.selector);
        market.borrow(1e18);

        // The correct procedure: fix the oracle itself. Once that's done,
        // Market's independent check is satisfied and borrowing resumes --
        // forceResume() was appropriately narrow, not a blanket bypass.
        vm.prank(owner);
        oracle.resumeOracle(500e18);

        vm.prank(alice);
        market.borrow(1e18);
    }
}
