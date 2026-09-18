// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Market} from "../../src/core/Market.sol";
import {HaltController} from "../../src/core/HaltController.sol";
import {LenderVault} from "../../src/core/LenderVault.sol";
import {InterestRateModel} from "../../src/core/InterestRateModel.sol";
import {SwapModule} from "../../src/periphery/SwapModule.sol";
import {LeverageZap} from "../../src/periphery/LeverageZap.sol";
import {MockPausableOracle} from "../../src/oracle/MockPausableOracle.sol";
import {MockWrappedXStock} from "../../src/tokens/MockWrappedXStock.sol";
import {MockUSDG} from "../../src/tokens/MockUSDG.sol";

contract LeverageZapTest is Test {
    Market market;
    HaltController controller;
    LenderVault vault;
    InterestRateModel irm;
    SwapModule swap;
    LeverageZap zap;
    MockPausableOracle oracle;
    MockWrappedXStock wNVDAx;
    MockUSDG usdg;

    address owner = address(0xA11CE);
    address keeper = address(0xCAFE);
    address alice = address(0xA11CE0);

    uint256 constant NVDA_PRICE = 180e18;
    uint256 constant MAX_LTV = 0.5e18;
    uint256 constant LIQ_THRESHOLD = 0.55e18;
    uint256 constant SWAP_FEE = 0.003e18;

    function setUp() public {
        vm.startPrank(owner);
        oracle = new MockPausableOracle(NVDA_PRICE, owner);
        wNVDAx = new MockWrappedXStock(owner);
        usdg = new MockUSDG(owner, 18);
        controller = new HaltController(address(oracle), owner, keeper);
        vault = new LenderVault(address(usdg), owner);
        irm = new InterestRateModel(0, 0.1e18, 3.0e18, 0.8e18, owner);
        market = new Market(
            address(wNVDAx), address(usdg), address(oracle), address(controller), address(vault), address(irm), owner, MAX_LTV, LIQ_THRESHOLD, 0
        );
        vault.setMarket(address(market));
        swap = new SwapModule(address(wNVDAx), address(usdg), address(oracle), address(controller), SWAP_FEE, owner);
        zap = new LeverageZap();

        // LP liquidity for borrowing.
        usdg.mint(owner, 1_000_000e18);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(1_000_000e18, owner);

        // Seed the swap module's collateral inventory.
        wNVDAx.mint(address(swap), 10_000e18);

        // Seed alice with collateral and let the zap pull it.
        wNVDAx.mint(alice, 100e18);
        vm.stopPrank();

        vm.startPrank(alice);
        wNVDAx.approve(address(zap), type(uint256).max);
        market.setOperator(address(zap), true);
        vm.stopPrank();
    }

    function test_Leverage_SuppliesInitialCollateralBorrowsSwapsAndSuppliesAgain() public {
        uint256 initial = 10e18; // 10 wNVDAx @ 180 = 1,800 USDG value, 50% LTV -> max borrow 900
        uint256 borrowAmount = 500e18;

        vm.prank(alice);
        zap.leverage(market, swap, initial, borrowAmount, 0);

        (uint256 collateral, uint256 debt) = market.getPosition(alice);
        // 10 initial + (500 * (1-0.003) / 180) swapped back in
        uint256 expectedCollateralFromSwap = (500e18 * (1e18 - SWAP_FEE)) / 180e18;
        assertEq(collateral, initial + expectedCollateralFromSwap);
        assertEq(debt, borrowAmount);

        // Nothing leftover in the zap -- fully atomic, no residual balances.
        assertEq(wNVDAx.balanceOf(address(zap)), 0);
        assertEq(usdg.balanceOf(address(zap)), 0);
        assertEq(wNVDAx.allowance(address(zap), address(market)), 0);
        assertEq(usdg.allowance(address(zap), address(swap)), 0);
    }

    function test_Leverage_ZeroInitialCollateral_AmplifiesExistingPosition() public {
        vm.startPrank(alice);
        wNVDAx.approve(address(market), type(uint256).max);
        market.supply(10e18); // alice already has a position, supplied directly
        vm.stopPrank();

        vm.prank(alice);
        zap.leverage(market, swap, 0, 500e18, 0);

        (uint256 collateral, uint256 debt) = market.getPosition(alice);
        uint256 expectedCollateralFromSwap = (500e18 * (1e18 - SWAP_FEE)) / 180e18;
        assertEq(collateral, 10e18 + expectedCollateralFromSwap);
        assertEq(debt, 500e18);
    }

    function test_Leverage_RevertsWithoutOperatorAuthorization() public {
        vm.prank(alice);
        market.setOperator(address(zap), false);

        vm.prank(alice);
        vm.expectRevert(Market.NotAuthorized.selector);
        zap.leverage(market, swap, 10e18, 500e18, 0);
    }

    function test_Leverage_RevertsWhenHalted() public {
        vm.prank(owner);
        controller.beginHalting();

        vm.prank(alice);
        vm.expectRevert(Market.MarketHalted.selector);
        zap.leverage(market, swap, 10e18, 500e18, 0);
    }

    function test_Leverage_RevertsAboveMaxLTV() public {
        vm.prank(alice);
        vm.expectRevert(Market.ExceedsMaxLTV.selector);
        // 10 wNVDAx -> max borrow 900; borrowing 901 exceeds it.
        zap.leverage(market, swap, 10e18, 901e18, 0);
    }

    function test_Leverage_RevertsOnSlippage() public {
        uint256 borrowAmount = 500e18;
        uint256 actualOut = (borrowAmount * (1e18 - SWAP_FEE)) / 180e18;

        vm.prank(alice);
        vm.expectRevert(LeverageZap.SlippageTooHigh.selector);
        zap.leverage(market, swap, 10e18, borrowAmount, actualOut + 1);
    }

    function test_Leverage_RevertsOnMismatchedSwapModule() public {
        vm.startPrank(owner);
        MockWrappedXStock otherCollateral = new MockWrappedXStock(owner);
        SwapModule mismatchedSwap =
            new SwapModule(address(otherCollateral), address(usdg), address(oracle), address(controller), SWAP_FEE, owner);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(LeverageZap.MismatchedSwapModule.selector);
        zap.leverage(market, mismatchedSwap, 10e18, 500e18, 0);
    }

    function test_Leverage_RevertsOnInsufficientSwapInventory() public {
        // Drain the swap module's collateral inventory.
        vm.prank(owner);
        swap.withdrawInventory(address(wNVDAx), owner, 10_000e18);

        vm.prank(alice);
        vm.expectRevert(SwapModule.InsufficientInventory.selector);
        zap.leverage(market, swap, 10e18, 500e18, 0);
    }

    function test_Leverage_EmitsEventWithActualAmounts() public {
        uint256 borrowAmount = 500e18;
        uint256 expectedCollateralFromSwap = (borrowAmount * (1e18 - SWAP_FEE)) / 180e18;

        vm.expectEmit(true, true, false, true);
        emit LeverageZap.Leveraged(alice, address(market), 10e18, borrowAmount, expectedCollateralFromSwap);

        vm.prank(alice);
        zap.leverage(market, swap, 10e18, borrowAmount, 0);
    }
}
