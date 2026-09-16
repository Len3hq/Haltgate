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

/// @notice Proves Market correctly handles a debt token with fewer decimals
/// than collateral -- exactly real USDG's shape (6 decimals), confirmed
/// directly against the live testnet contract. Mirrors Market.t.sol's
/// scenarios so the economics can be compared 1:1 against the 18-decimal
/// suite: same price, same LTV, same outcomes, just expressed in USDG's
/// actual 6-decimal units instead of assumed 18-decimal ones.
contract MarketDecimalsTest is Test {
    Market market;
    HaltController controller;
    LenderVault vault;
    InterestRateModel irm;
    MockPausableOracle oracle;
    MockWrappedXStock wNVDAx; // 18 decimals
    MockUSDG usdg; // 6 decimals -- matches real USDG

    address owner = address(0xA11CE);
    address keeper = address(0xCAFE);
    address alice = address(0xA11CE0);
    address liquidator = address(0xD00D);

    uint256 constant NVDA_PRICE = 180e18; // still an 18-decimal WAD ratio -- price is decimals-agnostic
    uint256 constant MAX_LTV = 0.5e18;
    uint256 constant LIQ_THRESHOLD = 0.55e18;
    uint8 constant USDG_DECIMALS = 6;

    function setUp() public {
        vm.startPrank(owner);
        oracle = new MockPausableOracle(NVDA_PRICE, owner);
        wNVDAx = new MockWrappedXStock(owner);
        usdg = new MockUSDG(owner, USDG_DECIMALS);
        controller = new HaltController(address(oracle), owner, keeper);
        vault = new LenderVault(address(usdg), owner);
        irm = new InterestRateModel(0, 0.1e18, 3.0e18, 0.8e18, owner);
        market = new Market(
            address(wNVDAx),
            address(usdg),
            address(oracle),
            address(controller),
            address(vault),
            address(irm),
            owner,
            MAX_LTV,
            LIQ_THRESHOLD,
            0
        );
        vault.setMarket(address(market));

        usdg.mint(owner, 100_000 * 10 ** USDG_DECIMALS);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(100_000 * 10 ** USDG_DECIMALS, owner);

        wNVDAx.mint(alice, 100e18);
        vm.stopPrank();

        vm.prank(alice);
        wNVDAx.approve(address(market), type(uint256).max);
        vm.prank(alice);
        usdg.approve(address(market), type(uint256).max);

        vm.prank(owner);
        usdg.mint(liquidator, 100_000 * 10 ** USDG_DECIMALS);
        vm.prank(liquidator);
        usdg.approve(address(market), type(uint256).max);
    }

    function test_Sanity_UsdgIsSixDecimals() public view {
        assertEq(usdg.decimals(), 6);
        assertEq(market.debtDecimals(), 6);
        assertEq(market.collateralDecimals(), 18);
    }

    function test_Borrow_WithinLTV_SixDecimalDebt() public {
        vm.startPrank(alice);
        market.supply(10e18); // value 1800 (WAD), same as the 18-decimal suite
        market.borrow(800 * 10 ** USDG_DECIMALS); // 800 USDG in its real 6-decimal units
        vm.stopPrank();

        (, uint256 debt) = market.getPosition(alice);
        assertEq(debt, 800 * 10 ** USDG_DECIMALS);
        assertEq(usdg.balanceOf(alice), 800 * 10 ** USDG_DECIMALS, "alice must receive real 6-decimal USDG units");
    }

    function test_Borrow_RevertsAboveMaxLTV_SixDecimalDebt() public {
        vm.startPrank(alice);
        market.supply(10e18); // value 1800, max borrow = 900
        vm.expectRevert(Market.ExceedsMaxLTV.selector);
        market.borrow(901 * 10 ** USDG_DECIMALS);
        vm.stopPrank();
    }

    function test_Borrow_ExactlyAtMaxLTV_Succeeds_SixDecimalDebt() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(900 * 10 ** USDG_DECIMALS); // exactly 50% of 1800
        vm.stopPrank();

        (, uint256 debt) = market.getPosition(alice);
        assertEq(debt, 900 * 10 ** USDG_DECIMALS);
    }

    function test_HealthFactor_MatchesEighteenDecimalEquivalent() public {
        vm.startPrank(alice);
        market.supply(10e18); // value 1800, liq threshold value = 990
        market.borrow(500 * 10 ** USDG_DECIMALS);
        vm.stopPrank();

        // Same economics as MarketTest.test_HealthFactor_AboveOne_WhenSafe: 990 / 500 = 1.98
        assertApproxEqAbs(market.healthFactor(alice), 1.98e18, 0.01e18);
        assertFalse(market.isLiquidatable(alice));
    }

    function test_Liquidate_SixDecimalDebt_SeizesCorrectCollateral() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(900 * 10 ** USDG_DECIMALS); // exactly maxLTV
        vm.stopPrank();

        vm.startPrank(owner);
        oracle.pauseOracle();
        controller.sync();
        oracle.resumeOracle(90e18); // price halves -> alice now liquidatable
        controller.sync();
        vm.stopPrank();
        vm.prank(keeper);
        controller.completeResume();

        assertTrue(market.isLiquidatable(alice));

        uint256 repayAmount = 100 * 10 ** USDG_DECIMALS;
        vm.prank(liquidator);
        market.liquidate(alice, repayAmount);

        (uint256 collateral, uint256 debt) = market.getPosition(alice);
        assertEq(debt, 800 * 10 ** USDG_DECIMALS, "debt should drop by exactly the repaid 6-decimal amount");

        // Same seizure math as the 18-decimal suite: (100/90) * 1.05 ~= 1.1666e18 wNVDAx
        uint256 repayWad = 100e18;
        uint256 priceForCalc = 90e18;
        uint256 bonus = 1.05e18;
        uint256 expectedSeized = (repayWad * bonus) / priceForCalc;
        assertEq(collateral, 10e18 - expectedSeized);
        assertEq(wNVDAx.balanceOf(liquidator), expectedSeized);
    }

    function test_IsSystemSolvent_SixDecimalDebt() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(500 * 10 ** USDG_DECIMALS);
        vm.stopPrank();

        assertTrue(market.isSystemSolvent());

        vm.startPrank(owner);
        oracle.pauseOracle();
        oracle.resumeOracle(1e18); // catastrophic price drop
        vm.stopPrank();

        assertFalse(market.isSystemSolvent());
    }

    function test_Repay_CapsAtOutstandingDebt_SixDecimalDebt() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(800 * 10 ** USDG_DECIMALS);
        deal(address(usdg), alice, 10_000 * 10 ** USDG_DECIMALS);
        market.repay(5_000 * 10 ** USDG_DECIMALS); // way more than owed
        vm.stopPrank();

        (, uint256 debt) = market.getPosition(alice);
        assertEq(debt, 0, "repay should cap at outstanding debt, not underflow, regardless of decimals");
    }
}
