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

/// @notice Fixed-rate, fixed-term loans: a different risk model from the
/// variable market. The rate is locked at origination and the position can
/// never be liquidated on price, so maturity replaces liquidation as the
/// mechanism that resolves the loan. These tests are mostly about the
/// consequences of that swap.
contract MarketFixedTermTest is Test {
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
    address lp = address(0x11D);
    address stranger = address(0xBEEF);

    uint256 constant PRICE = 180e18;
    uint256 constant MAX_LTV = 0.5e18;
    uint256 constant LIQ_THRESHOLD = 0.55e18;
    uint256 constant FIXED_LTV = 0.35e18; // NVDA tier
    uint256 constant FIXED_RATE = 0.08e18; // 8%/yr

    function setUp() public {
        vm.startPrank(owner);
        oracle = new MockPausableOracle(PRICE, owner);
        wNVDAx = new MockWrappedXStock("Mock Wrapped NVIDIA xStock", "wNVDAx-MOCK", owner);
        usdg = new MockUSDG(owner, 18);
        controller = new HaltController(address(oracle), owner, keeper);
        vault = new LenderVault(address(usdg), owner);
        irm = new InterestRateModel(0, 0.1e18, 3.0e18, 0.8e18, owner);
        market = new Market(
            address(wNVDAx), address(usdg), address(oracle), address(controller), address(vault), address(irm), owner, MAX_LTV, LIQ_THRESHOLD, 0
        );
        vault.setMarket(address(market));
        market.setFixedParams(FIXED_LTV, FIXED_RATE);

        usdg.mint(lp, 100_000e18);
        usdg.mint(alice, 10_000e18); // to repay interest with
        wNVDAx.mint(alice, 100e18);
        vm.stopPrank();

        vm.startPrank(lp);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(100_000e18, lp);
        vm.stopPrank();

        vm.startPrank(alice);
        wNVDAx.approve(address(market), type(uint256).max);
        usdg.approve(address(market), type(uint256).max);
        vm.stopPrank();
    }

    // --- Origination ------------------------------------------------------

    function test_BorrowFixed_OpensLoanAndLocksCollateral() public {
        vm.prank(alice);
        market.borrowFixed(10e18, 500e18, 30 days);

        (uint256 collateral, uint256 principal, uint256 owed, uint256 maturity) = market.fixedLoans(alice);
        assertEq(collateral, 10e18);
        assertEq(principal, 500e18);
        assertEq(maturity, block.timestamp + 30 days);
        assertGt(owed, principal, "interest is priced in at origination");
        assertEq(wNVDAx.balanceOf(address(market)), 10e18, "collateral held by the market");
        assertEq(usdg.balanceOf(alice), 10_000e18 + 500e18, "borrowed cash delivered");
    }

    function test_BorrowFixed_UsesTheLowerFixedLtv_NotMaxLtv() public {
        // 10 wNVDAx @ 180 = 1,800 of value. Variable would allow 900 (50%);
        // fixed allows only 630 (35%).
        vm.prank(alice);
        vm.expectRevert(Market.ExceedsMaxLTV.selector);
        market.borrowFixed(10e18, 631e18, 30 days);

        vm.prank(alice);
        market.borrowFixed(10e18, 630e18, 30 days);
        (, uint256 principal,,) = market.fixedLoans(alice);
        assertEq(principal, 630e18);
    }

    function test_QuoteFixed_ScalesWithTerm() public view {
        uint256 d1 = market.quoteFixed(1_000e18, 1 days);
        uint256 d30 = market.quoteFixed(1_000e18, 30 days);
        assertGt(d1, 1_000e18);
        assertApproxEqRel(d30 - 1_000e18, (d1 - 1_000e18) * 30, 0.0001e18, "simple interest, linear in term");
    }

    function test_BorrowFixed_RejectsTermsOutsideBounds() public {
        uint256 tooShort = market.MIN_FIXED_TERM() - 1;
        uint256 tooLong = market.MAX_FIXED_TERM() + 1;

        vm.prank(alice);
        vm.expectRevert(Market.InvalidTerm.selector);
        market.borrowFixed(10e18, 100e18, tooShort);

        vm.prank(alice);
        vm.expectRevert(Market.InvalidTerm.selector);
        market.borrowFixed(10e18, 100e18, tooLong);
    }

    function test_BorrowFixed_OneLoanAtATime() public {
        vm.startPrank(alice);
        market.borrowFixed(10e18, 100e18, 7 days);
        vm.expectRevert(Market.LoanAlreadyOpen.selector);
        market.borrowFixed(10e18, 100e18, 7 days);
        vm.stopPrank();
    }

    function test_BorrowFixed_RevertsWhenHalted() public {
        vm.prank(owner);
        controller.beginHalting();
        vm.prank(alice);
        vm.expectRevert(Market.MarketHalted.selector);
        market.borrowFixed(10e18, 100e18, 7 days);
    }

    // --- The no-liquidation promise ---------------------------------------

    function test_PriceCollapse_DoesNotMakeFixedLoanLiquidatable() public {
        vm.prank(alice);
        market.borrowFixed(10e18, 600e18, 30 days);

        // A 75% collapse exceeds the oracle's normal-update deviation cap, so
        // it can only arrive through a full halt cycle -- which is also how a
        // real corporate-action repricing would land.
        uint256 maturity = block.timestamp + 30 days;
        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();
        vm.prank(owner);
        oracle.resumeOracle(45e18); // 180 -> 45
        controller.sync();
        vm.prank(keeper);
        controller.completeResume();

        // The variable-market view is untouched by the fixed loan...
        assertFalse(market.isLiquidatable(alice), "fixed collateral is not part of the variable position");
        // ...and nothing can close the fixed loan before maturity.
        vm.expectRevert(abi.encodeWithSelector(Market.NotMatured.selector, maturity));
        market.settleMatured(alice);
    }

    function test_FixedCollateralIsSeparateFromVariablePosition() public {
        vm.startPrank(alice);
        market.supply(20e18); // variable position
        market.borrowFixed(10e18, 300e18, 30 days);
        vm.stopPrank();

        (uint256 variableCollateral,) = market.getPosition(alice);
        (uint256 fixedCollateral,,,) = market.fixedLoans(alice);
        assertEq(variableCollateral, 20e18, "variable collateral untouched by the fixed loan");
        assertEq(fixedCollateral, 10e18);
        assertEq(market.totalCollateral(), 20e18, "fixed collateral is not counted as variable");
    }

    // --- Repayment --------------------------------------------------------

    function test_RepayFixed_ReturnsCollateralAndClearsLoan() public {
        vm.prank(alice);
        market.borrowFixed(10e18, 500e18, 30 days);
        (,, uint256 owed,) = market.fixedLoans(alice);

        uint256 before = wNVDAx.balanceOf(alice);
        vm.prank(alice);
        market.repayFixed();

        assertEq(wNVDAx.balanceOf(alice), before + 10e18, "collateral unlocked");
        (, uint256 principal,,) = market.fixedLoans(alice);
        assertEq(principal, 0, "loan cleared");
        assertEq(market.totalFixedPrincipal(), 0);
        assertGt(owed, 500e18);
    }

    function test_RepayFixed_AllowedWhileHalted() public {
        vm.prank(alice);
        market.borrowFixed(10e18, 500e18, 30 days);

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();

        // Repaying only reduces risk, so it is never blocked.
        vm.prank(alice);
        market.repayFixed();
        (, uint256 principal,,) = market.fixedLoans(alice);
        assertEq(principal, 0);
    }

    function test_RepayFixed_RevertsWithoutALoan() public {
        vm.prank(alice);
        vm.expectRevert(Market.NoFixedLoan.selector);
        market.repayFixed();
    }

    function test_RepayFixed_LiftsSharePriceByTheInterest() public {
        uint256 priceBefore = vault.convertToAssets(1e18);

        vm.startPrank(alice);
        market.borrowFixed(10e18, 500e18, 30 days);
        // Lending the principal out must not move the share price by itself.
        assertApproxEqRel(vault.convertToAssets(1e18), priceBefore, 0.0001e18, "principal is still an asset");
        market.repayFixed();
        vm.stopPrank();

        assertGt(vault.convertToAssets(1e18), priceBefore, "interest arrives on repayment");
    }

    // --- Default ----------------------------------------------------------

    function test_SettleMatured_ClaimsWholeCollateral() public {
        vm.prank(alice);
        market.borrowFixed(10e18, 500e18, 7 days);

        vm.warp(block.timestamp + 7 days);
        vm.prank(stranger); // permissionless, like liquidation
        market.settleMatured(alice);

        (, uint256 principal,,) = market.fixedLoans(alice);
        assertEq(principal, 0, "loan closed out");
        assertEq(market.seizedCollateral(), 10e18, "entire collateral claimed, no price needed");
        assertEq(market.totalFixedPrincipal(), 0);
    }

    function test_SettleMatured_RevertsBeforeMaturity() public {
        vm.prank(alice);
        market.borrowFixed(10e18, 500e18, 7 days);
        uint256 maturity = block.timestamp + 7 days;

        vm.warp(maturity - 1);
        vm.expectRevert(abi.encodeWithSelector(Market.NotMatured.selector, maturity));
        market.settleMatured(alice);
    }

    function test_SettleMatured_BlockedWhileHalted() public {
        vm.prank(alice);
        market.borrowFixed(10e18, 500e18, 7 days);
        vm.warp(block.timestamp + 8 days);

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();

        // A borrower must not lose collateral during a window the market
        // itself is halted -- and they can still repay their way out.
        vm.expectRevert(Market.MarketHalted.selector);
        market.settleMatured(alice);

        vm.prank(alice);
        market.repayFixed();
        (, uint256 principal,,) = market.fixedLoans(alice);
        assertEq(principal, 0, "repayment remains available through the halt");
    }

    function test_Default_ShowsUpAsLostPrincipalUntilCollateralIsConverted() public {
        uint256 priceBefore = vault.convertToAssets(1e18);

        vm.prank(alice);
        market.borrowFixed(10e18, 500e18, 7 days);
        vm.warp(block.timestamp + 7 days);
        market.settleMatured(alice);

        assertLt(vault.convertToAssets(1e18), priceBefore, "principal is gone from the vault's assets");

        // Governance converts the claimed collateral and returns the proceeds.
        vm.prank(owner);
        market.withdrawSeizedCollateral(owner, 10e18);
        assertEq(market.seizedCollateral(), 0);
        assertEq(wNVDAx.balanceOf(owner), 10e18);
    }

    function test_WithdrawSeizedCollateral_OnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        market.withdrawSeizedCollateral(stranger, 1);
    }

    function test_IsFixedDefaulted_FlipsAtMaturity() public {
        vm.prank(alice);
        market.borrowFixed(10e18, 500e18, 7 days);
        assertFalse(market.isFixedDefaulted(alice));

        vm.warp(block.timestamp + 7 days);
        assertTrue(market.isFixedDefaulted(alice));
    }

    // --- Lender-side interaction ------------------------------------------

    function test_FixedBorrow_ConstrainsLpWithdrawals() public {
        uint256 before = vault.maxWithdraw(lp);

        vm.prank(alice);
        market.borrowFixed(10e18, 600e18, 30 days);

        // Locked capital is simply cash that left the vault, so the existing
        // cash cap already handles it -- no separate accounting needed.
        assertApproxEqAbs(vault.maxWithdraw(lp), before - 600e18, 1, "withdrawable drops by exactly the loan");
    }

    // --- Governance bounds ------------------------------------------------

    function test_SetFixedParams_CannotExceedVariableMaxLtv() public {
        vm.prank(owner);
        vm.expectRevert(Market.InvalidFixedParams.selector);
        market.setFixedParams(MAX_LTV + 1, FIXED_RATE);
    }

    function test_SetFixedParams_OnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        market.setFixedParams(0.3e18, FIXED_RATE);
    }

    function test_BorrowFixed_RevertsIfFixedLendingNotConfigured() public {
        vm.startPrank(owner);
        Market fresh = new Market(
            address(wNVDAx), address(usdg), address(oracle), address(controller), address(vault), address(irm), owner, MAX_LTV, LIQ_THRESHOLD, 0
        );
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(Market.InvalidFixedParams.selector);
        fresh.borrowFixed(10e18, 100e18, 7 days);
    }
}
