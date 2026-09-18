// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {SwapModule} from "../../src/periphery/SwapModule.sol";
import {HaltController} from "../../src/core/HaltController.sol";
import {MockPausableOracle} from "../../src/oracle/MockPausableOracle.sol";
import {MockWrappedXStock} from "../../src/tokens/MockWrappedXStock.sol";
import {MockUSDG} from "../../src/tokens/MockUSDG.sol";

contract SwapModuleTest is Test {
    SwapModule swap;
    HaltController controller;
    MockPausableOracle oracle;
    MockWrappedXStock wNVDAx;
    MockUSDG usdg;

    address owner = address(0xA11CE);
    address keeper = address(0xCAFE);
    address trader = address(0xB0B);

    uint256 constant NVDA_PRICE = 180e18; // 1 wNVDAx = 180 USDG
    uint256 constant FEE = 0.003e18; // 0.30%, per the confirmed default

    function setUp() public {
        vm.startPrank(owner);
        oracle = new MockPausableOracle(NVDA_PRICE, owner);
        wNVDAx = new MockWrappedXStock(owner);
        usdg = new MockUSDG(owner, 18);
        controller = new HaltController(address(oracle), owner, keeper);
        swap = new SwapModule(address(wNVDAx), address(usdg), address(oracle), address(controller), FEE, owner);

        // Seed the module's inventory both directions so either swap
        // function has something to draw from.
        wNVDAx.mint(address(swap), 1_000e18);
        usdg.mint(address(swap), 1_000_000e18);

        // Seed trader with both tokens so both swap directions are testable.
        wNVDAx.mint(trader, 100e18);
        usdg.mint(trader, 100_000e18);
        vm.stopPrank();

        vm.startPrank(trader);
        wNVDAx.approve(address(swap), type(uint256).max);
        usdg.approve(address(swap), type(uint256).max);
        vm.stopPrank();
    }

    // --- swapDebtForCollateral -------------------------------------------

    function test_SwapDebtForCollateral_CorrectAmountAfterFee() public {
        uint256 usdgIn = 1_800e18; // -> 10 wNVDAx before fee, at 180 USDG each
        uint256 expectedBeforeFee = 10e18;
        uint256 expectedAfterFee = (expectedBeforeFee * (1e18 - FEE)) / 1e18;

        vm.prank(trader);
        uint256 out = swap.swapDebtForCollateral(usdgIn, trader);

        assertEq(out, expectedAfterFee);
        assertEq(wNVDAx.balanceOf(trader), 100e18 + expectedAfterFee);
        assertEq(usdg.balanceOf(address(swap)), 1_000_000e18 + usdgIn);
    }

    function test_SwapDebtForCollateral_SendsToArbitraryRecipient() public {
        address recipient = address(0xFEED);
        vm.prank(trader);
        uint256 out = swap.swapDebtForCollateral(1_800e18, recipient);
        assertEq(wNVDAx.balanceOf(recipient), out);
        assertEq(wNVDAx.balanceOf(trader), 100e18); // trader's own balance untouched
    }

    function test_SwapDebtForCollateral_RevertsOnZeroAmount() public {
        vm.prank(trader);
        vm.expectRevert(SwapModule.ZeroAmount.selector);
        swap.swapDebtForCollateral(0, trader);
    }

    function test_SwapDebtForCollateral_RevertsWhenHalted() public {
        vm.prank(owner);
        controller.beginHalting();
        // beginHalting() moves state to HALTING, already not OPEN.
        vm.prank(trader);
        vm.expectRevert(SwapModule.MarketHalted.selector);
        swap.swapDebtForCollateral(1_800e18, trader);
    }

    // --- swapCollateralForDebt --------------------------------------------

    function test_SwapCollateralForDebt_CorrectAmountAfterFee() public {
        uint256 collateralIn = 10e18; // -> 1,800 USDG before fee
        uint256 expectedBeforeFee = 1_800e18;
        uint256 expectedAfterFee = (expectedBeforeFee * (1e18 - FEE)) / 1e18;

        vm.prank(trader);
        uint256 out = swap.swapCollateralForDebt(collateralIn, trader);

        assertEq(out, expectedAfterFee);
        assertEq(usdg.balanceOf(trader), 100_000e18 + expectedAfterFee);
    }

    // --- Oracle freshness, independent of HaltController's own state -----

    // Mirrors Market's own _requireFreshPrice defense-in-depth: the oracle
    // can be paused directly (e.g. mid corporate-action) before anyone has
    // called HaltController.sync() to reflect it in `state` -- whenOpen alone
    // would pass during that window, so this check must not depend on it.
    function test_SwapDebtForCollateral_RevertsWhenOraclePausedDirectly_EvenIfControllerStateStillOpen() public {
        vm.prank(owner);
        oracle.pauseOracle();
        assertTrue(controller.canSupplyOrBorrow(), "controller state hasn't synced yet -- still OPEN");

        vm.prank(trader);
        vm.expectRevert(SwapModule.OraclePausedDirectly.selector);
        swap.swapDebtForCollateral(1_800e18, trader);
    }

    function test_SwapDebtForCollateral_RevertsOnStaleOracle() public {
        vm.warp(block.timestamp + 25 hours);
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(SwapModule.StaleOracle.selector, block.timestamp - 25 hours, 24 hours));
        swap.swapDebtForCollateral(1_800e18, trader);
    }

    // --- Inventory ---------------------------------------------------------

    function test_SwapDebtForCollateral_RevertsOnInsufficientInventory() public {
        // Drain the module's wNVDAx inventory first.
        vm.prank(owner);
        swap.withdrawInventory(address(wNVDAx), owner, 1_000e18);

        vm.prank(trader);
        vm.expectRevert(SwapModule.InsufficientInventory.selector);
        swap.swapDebtForCollateral(1_800e18, trader);
    }

    function test_WithdrawInventory_OnlyOwner() public {
        vm.prank(trader);
        vm.expectRevert(); // OZ's OwnableUnauthorizedAccount
        swap.withdrawInventory(address(wNVDAx), trader, 1e18);
    }

    // --- Fee governance ------------------------------------------------------

    function test_SetFee_OnlyOwner() public {
        vm.prank(trader);
        vm.expectRevert();
        swap.setFee(0.01e18);
    }

    function test_SetFee_RevertsAboveMaxFee() public {
        uint256 tooHigh = swap.MAX_FEE() + 1;
        vm.prank(owner);
        vm.expectRevert(SwapModule.FeeTooHigh.selector);
        swap.setFee(tooHigh);
    }

    function test_Constructor_RevertsAboveMaxFee() public {
        uint256 tooHigh = swap.MAX_FEE() + 1;
        vm.expectRevert(SwapModule.FeeTooHigh.selector);
        new SwapModule(address(wNVDAx), address(usdg), address(oracle), address(controller), tooHigh, owner);
    }

    function test_SetFee_UpdatesSubsequentSwaps() public {
        vm.prank(owner);
        swap.setFee(0); // no fee

        vm.prank(trader);
        uint256 out = swap.swapDebtForCollateral(1_800e18, trader);
        assertEq(out, 10e18); // exact, no fee shaved off
    }

    // --- Decimals (mirrors Market.Decimals.t.sol's rigor) -----------------

    function test_SwapDebtForCollateral_CorrectWith6DecimalDebtToken() public {
        vm.startPrank(owner);
        MockUSDG usdg6 = new MockUSDG(owner, 6);
        SwapModule swap6 =
            new SwapModule(address(wNVDAx), address(usdg6), address(oracle), address(controller), FEE, owner);
        wNVDAx.mint(address(swap6), 1_000e18);
        usdg6.mint(trader, 100_000e6);
        vm.stopPrank();

        vm.startPrank(trader);
        usdg6.approve(address(swap6), type(uint256).max);
        uint256 out = swap6.swapDebtForCollateral(1_800e6, trader); // 1,800 USDG, 6 decimals
        vm.stopPrank();

        uint256 expectedAfterFee = (10e18 * (1e18 - FEE)) / 1e18;
        assertEq(out, expectedAfterFee);
    }
}
