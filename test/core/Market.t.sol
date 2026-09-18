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

contract MarketTest is Test {
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
    address liquidator = address(0xD00D);

    uint256 constant NVDA_PRICE = 180e18; // 1 wNVDAx = 180 USDG
    uint256 constant MAX_LTV = 0.5e18; // 50%
    uint256 constant LIQ_THRESHOLD = 0.55e18; // 55%

    function setUp() public {
        vm.startPrank(owner);
        oracle = new MockPausableOracle(NVDA_PRICE, owner);
        wNVDAx = new MockWrappedXStock("Mock Wrapped NVIDIA xStock", "wNVDAx-MOCK", owner);
        usdg = new MockUSDG(owner, 18);
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
            0 // reserveFactor -- 0 by default, dedicated tests cover nonzero
        );
        vault.setMarket(address(market));

        // Seed vault liquidity via a normal LP deposit.
        usdg.mint(owner, 100_000e18);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(100_000e18, owner);

        // Seed alice with collateral.
        wNVDAx.mint(alice, 100e18);
        vm.stopPrank();

        vm.prank(alice);
        wNVDAx.approve(address(market), type(uint256).max);
        vm.prank(alice);
        usdg.approve(address(market), type(uint256).max);
    }

    function test_VaultDeposit_PermissionlessAnyoneCanAddLiquidity() public {
        // Standing in for the old custom fundMarket() access-control test:
        // ERC4626.deposit() is permissionless by the standard itself, no
        // custom guard needed -- this just confirms a non-owner can use it.
        vm.prank(owner);
        usdg.mint(alice, 1_000e18);
        vm.prank(alice);
        usdg.approve(address(vault), 1_000e18);

        uint256 collateralBefore = market.totalCollateral(); // sanity, unrelated to debt token balance
        vm.prank(alice);
        uint256 shares = vault.deposit(1_000e18, alice);

        assertGt(shares, 0, "alice should receive vault shares for her deposit");
        assertEq(usdg.balanceOf(address(vault)), 100_000e18 + 1_000e18, "vault's USDG balance should include alice's deposit");
        assertEq(market.totalCollateral(), collateralBefore, "vault deposits must not affect Market's collateral accounting");
    }

    function test_Supply() public {
        vm.prank(alice);
        market.supply(10e18);

        (uint256 collateral,) = market.getPosition(alice);
        assertEq(collateral, 10e18);
        assertEq(market.totalCollateral(), 10e18);
        assertEq(wNVDAx.balanceOf(address(market)), 10e18);
    }

    function test_Withdraw_FullAmount_NoDebt() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.withdraw(10e18);
        vm.stopPrank();

        (uint256 collateral,) = market.getPosition(alice);
        assertEq(collateral, 0);
        assertEq(market.totalCollateral(), 0);
        assertEq(wNVDAx.balanceOf(alice), 100e18, "alice should have all her wNVDAx back");
    }

    function test_Withdraw_RevertsIfExceedsSuppliedCollateral() public {
        vm.startPrank(alice);
        market.supply(10e18);
        vm.expectRevert(Market.InsufficientCollateral.selector);
        market.withdraw(10e18 + 1);
        vm.stopPrank();
    }

    function test_Withdraw_ZeroDebt_AllowedEvenWhenHalted() public {
        vm.startPrank(alice);
        market.supply(10e18);
        vm.stopPrank();

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();

        vm.prank(alice);
        market.withdraw(10e18); // must not revert -- no debt, no risk to protect

        (uint256 collateral,) = market.getPosition(alice);
        assertEq(collateral, 0);
    }

    function test_Withdraw_WithDebt_StaysWithinLTV_Succeeds() public {
        vm.startPrank(alice);
        market.supply(10e18); // value 1800, borrow 500 well within 50%
        market.borrow(500e18);
        market.withdraw(2e18); // remaining 8e18 * 180 = 1440, still covers 500 debt at 50% LTV (max 720)
        vm.stopPrank();

        (uint256 collateral,) = market.getPosition(alice);
        assertEq(collateral, 8e18);
    }

    function test_Withdraw_WithDebt_RevertsIfExceedsMaxLTV() public {
        vm.startPrank(alice);
        market.supply(10e18); // value 1800, borrow at exactly 50% max (900)
        market.borrow(900e18);
        vm.expectRevert(Market.ExceedsMaxLTV.selector);
        market.withdraw(1e18); // remaining 9e18 * 180 = 1620, 50% = 810 < 900 debt
        vm.stopPrank();
    }

    function test_Withdraw_WithDebt_RevertsWhenHalted() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(500e18);
        vm.stopPrank();

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();

        vm.prank(alice);
        vm.expectRevert(Market.MarketHalted.selector);
        market.withdraw(1e18); // has debt -- withdrawing raises risk, must be gated like borrow
    }

    function test_Borrow_WithinLTV() public {
        vm.startPrank(alice);
        market.supply(10e18); // 10 * 180 = 1800 USDG collateral value
        market.borrow(800e18); // well within 50% of 1800 = 900
        vm.stopPrank();

        (, uint256 debt) = market.getPosition(alice);
        assertEq(debt, 800e18);
        assertEq(usdg.balanceOf(alice), 800e18);
    }

    function test_Borrow_RevertsAboveMaxLTV() public {
        vm.startPrank(alice);
        market.supply(10e18); // collateral value 1800, max borrow = 900
        vm.expectRevert(Market.ExceedsMaxLTV.selector);
        market.borrow(901e18);
        vm.stopPrank();
    }

    function test_Borrow_ExactlyAtMaxLTV_Succeeds() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(900e18); // exactly 50% of 1800
        vm.stopPrank();

        (, uint256 debt) = market.getPosition(alice);
        assertEq(debt, 900e18);
    }

    function test_Repay_ReducesDebt() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(800e18);
        market.repay(300e18);
        vm.stopPrank();

        (, uint256 debt) = market.getPosition(alice);
        assertEq(debt, 500e18);
        assertEq(market.totalBorrows(), 500e18);
    }

    function test_Repay_CapsAtOutstandingDebt() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(800e18);
        deal(address(usdg), alice, 10_000e18); // give alice more than her debt to attempt overpay
        market.repay(5_000e18);
        vm.stopPrank();

        (, uint256 debt) = market.getPosition(alice);
        assertEq(debt, 0, "repay should cap at outstanding debt, not underflow");
    }

    function test_SupplyAndBorrow_BlockedWhenHalted() public {
        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();

        vm.startPrank(alice);
        vm.expectRevert(Market.MarketHalted.selector);
        market.supply(1e18);

        vm.expectRevert(Market.MarketHalted.selector);
        market.borrow(1e18);
        vm.stopPrank();
    }

    function test_Repay_AlwaysAllowed_EvenWhenHalted() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(500e18);
        vm.stopPrank();

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();

        vm.prank(alice);
        market.repay(200e18); // must not revert

        (, uint256 debt) = market.getPosition(alice);
        assertEq(debt, 300e18);
    }

    function test_HealthFactor_NoDebt_IsMax() public {
        vm.prank(alice);
        market.supply(10e18);
        assertEq(market.healthFactor(alice), type(uint256).max);
    }

    function test_HealthFactor_AboveOne_WhenSafe() public {
        vm.startPrank(alice);
        market.supply(10e18); // value 1800, liq threshold value = 990
        market.borrow(500e18);
        vm.stopPrank();

        // 990 / 500 = 1.98
        assertApproxEqAbs(market.healthFactor(alice), 1.98e18, 0.01e18);
        assertFalse(market.isLiquidatable(alice));
    }

    function test_IsLiquidatable_TrueWhenPriceDrops() public {
        vm.startPrank(alice);
        market.supply(10e18); // value 1800 @ 180/share
        market.borrow(900e18); // at exactly maxLTV (50%), still under liq threshold (55% = 990)
        vm.stopPrank();

        assertFalse(market.isLiquidatable(alice));

        // Price crashes post-resume (e.g. bad earnings priced in).
        vm.startPrank(owner);
        oracle.pauseOracle();
        oracle.resumeOracle(90e18); // halves in value -> collateral value now 900
        vm.stopPrank();

        // liq threshold value = 900 * 0.55 = 495 < 900 debt
        assertTrue(market.isLiquidatable(alice));
    }

    function test_IsSystemSolvent() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(500e18);
        vm.stopPrank();

        assertTrue(market.isSystemSolvent());

        vm.startPrank(owner);
        oracle.pauseOracle();
        oracle.resumeOracle(1e18); // catastrophic price drop
        vm.stopPrank();

        assertFalse(market.isSystemSolvent());
    }

    function test_SetRiskParams_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        market.setRiskParams(0.4e18, 0.45e18);

        vm.prank(owner);
        market.setRiskParams(0.4e18, 0.45e18);
        assertEq(market.maxLTV(), 0.4e18);
        assertEq(market.liquidationThreshold(), 0.45e18);
    }

    function test_Constructor_RevertsIfLiqThresholdNotAboveLTV() public {
        vm.expectRevert(Market.InvalidRiskParams.selector);
        new Market(
            address(wNVDAx), address(usdg), address(oracle), address(controller), address(vault), address(irm), owner, 0.5e18, 0.5e18, 0
        );
    }

    // --- Liquidation ---

    function _makeAliceLiquidatable() internal {
        vm.startPrank(alice);
        market.supply(10e18); // value 1800 @ 180
        market.borrow(900e18); // exactly maxLTV, safe until price moves
        vm.stopPrank();

        vm.startPrank(owner);
        oracle.pauseOracle();
        controller.sync(); // OPEN -> HALTED
        oracle.resumeOracle(90e18); // price halves -> collateral value now 900
        controller.sync(); // HALTED -> RESUMING
        controller.completeResume(); // RESUMING -> OPEN (owner is also keeper-equivalent here)
        vm.stopPrank();
        // liq threshold value = 900 * 0.55 = 495 < 900 debt -> liquidatable
    }

    function test_Liquidate_Success() public {
        _makeAliceLiquidatable();
        assertTrue(market.isLiquidatable(alice));

        vm.prank(owner);
        usdg.mint(liquidator, 1_000e18);
        vm.startPrank(liquidator);
        usdg.approve(address(market), type(uint256).max);
        market.liquidate(alice, 100e18);
        vm.stopPrank();

        (uint256 collateral, uint256 debt) = market.getPosition(alice);
        assertEq(debt, 800e18, "debt should drop by exactly the repaid amount");

        // collateral seized = (100 / 90) * 1.05 = 1.1666...e18
        uint256 repayAmount_ = 100e18;
        uint256 price_ = 90e18;
        uint256 bonusMultiplier = 1.05e18;
        uint256 collateralAtPar = (repayAmount_ * 1e18) / price_;
        uint256 expectedSeized = (collateralAtPar * bonusMultiplier) / 1e18;
        assertEq(collateral, 10e18 - expectedSeized);
        assertEq(wNVDAx.balanceOf(liquidator), expectedSeized);
    }

    function test_Liquidate_RevertsWhenNotLiquidatable() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(500e18); // safely within thresholds
        vm.stopPrank();

        vm.prank(liquidator);
        vm.expectRevert(Market.NotLiquidatable.selector);
        market.liquidate(alice, 100e18);
    }

    function test_Liquidate_RevertsWhenHalted() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(900e18);
        vm.stopPrank();

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync(); // HALTED

        vm.prank(liquidator);
        vm.expectRevert(Market.MarketHalted.selector);
        market.liquidate(alice, 100e18);
    }

    function test_Liquidate_RevertsDuringResuming() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(900e18);
        vm.stopPrank();

        vm.startPrank(owner);
        oracle.pauseOracle();
        controller.sync(); // OPEN -> HALTED
        oracle.resumeOracle(90e18);
        controller.sync(); // HALTED -> RESUMING (price already reflects the crash, alice IS liquidatable)
        vm.stopPrank();

        assertTrue(market.isLiquidatable(alice), "sanity: alice should already be liquidatable in RESUMING");

        vm.prank(liquidator);
        vm.expectRevert(Market.MarketHalted.selector);
        market.liquidate(alice, 100e18); // must still revert -- BUILD.md: liquidations wait until fully OPEN
    }

    function test_Liquidate_CapsAtCloseFactor() public {
        _makeAliceLiquidatable();

        vm.prank(owner);
        usdg.mint(liquidator, 10_000e18);
        vm.startPrank(liquidator);
        usdg.approve(address(market), type(uint256).max);
        market.liquidate(alice, 10_000e18); // way more than 50% close factor allows
        vm.stopPrank();

        (, uint256 debt) = market.getPosition(alice);
        assertEq(debt, 450e18, "repay should cap at 50% of the 900 debt, i.e. 450");
    }

    function test_SetLiquidationBonus_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        market.setLiquidationBonus(0.1e18);

        vm.prank(owner);
        market.setLiquidationBonus(0.1e18);
        assertEq(market.liquidationBonus(), 0.1e18);
    }
}
