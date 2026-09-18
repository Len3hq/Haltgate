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

/// @notice Covers the operator-delegation surface added specifically to
/// support LeverageZap (BUILD.md §11 Milestone 1): Market.supply()/borrow()
/// are hardcoded to credit msg.sender's own position, so a periphery
/// contract calling them directly would end up owning the resulting
/// position itself instead of the user who actually wants it. setOperator()
/// plus supplyFor()/borrowFor() close that gap without changing supply()/
/// borrow()'s own existing behavior at all (see Market.t.sol for that).
contract MarketOperatorTest is Test {
    Market market;
    HaltController controller;
    LenderVault vault;
    InterestRateModel irm;
    MockPausableOracle oracle;
    MockWrappedXStock wNVDAx;
    MockUSDG usdg;

    address owner = address(0xA11CE);
    address keeper = address(0xCAFE);
    address alice = address(0xA11CE0); // position owner
    address zap = address(0x2AB); // stand-in for a periphery contract like LeverageZap
    address stranger = address(0xBAD);

    uint256 constant NVDA_PRICE = 180e18;
    uint256 constant MAX_LTV = 0.5e18;
    uint256 constant LIQ_THRESHOLD = 0.55e18;

    function setUp() public {
        vm.startPrank(owner);
        oracle = new MockPausableOracle(NVDA_PRICE, owner);
        wNVDAx = new MockWrappedXStock("Mock Wrapped NVIDIA xStock", "wNVDAx-MOCK", owner);
        usdg = new MockUSDG(owner, 18);
        controller = new HaltController(address(oracle), owner, keeper);
        vault = new LenderVault(address(usdg), owner);
        irm = new InterestRateModel(0, 0.1e18, 3.0e18, 0.8e18, owner);
        market = new Market(
            address(wNVDAx), address(usdg), address(oracle), address(controller), address(vault), address(irm), owner, MAX_LTV, LIQ_THRESHOLD, 0
        );
        vault.setMarket(address(market));

        usdg.mint(owner, 100_000e18);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(100_000e18, owner);

        // "zap" holds the collateral it'll supplyFor()/receive borrowFor()
        // cash into, exactly like LeverageZap would mid-transaction.
        wNVDAx.mint(zap, 100e18);
        vm.stopPrank();

        vm.prank(zap);
        wNVDAx.approve(address(market), type(uint256).max);
    }

    // --- setOperator ---------------------------------------------------

    function test_SetOperator_GrantsAndRevokes() public {
        assertFalse(market.isOperator(alice, zap));

        vm.prank(alice);
        market.setOperator(zap, true);
        assertTrue(market.isOperator(alice, zap));

        vm.prank(alice);
        market.setOperator(zap, false);
        assertFalse(market.isOperator(alice, zap));
    }

    function test_SetOperator_RevertsOnZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert(Market.ZeroAddress.selector);
        market.setOperator(address(0), true);
    }

    function test_SetOperator_OnlyAffectsCallersOwnMapping() public {
        vm.prank(alice);
        market.setOperator(zap, true);
        // Nobody else's mapping moved just because alice authorized zap.
        assertFalse(market.isOperator(stranger, zap));
    }

    // --- supplyFor -------------------------------------------------------

    function test_SupplyFor_RevertsWithoutAuthorization() public {
        vm.prank(zap);
        vm.expectRevert(Market.NotAuthorized.selector);
        market.supplyFor(alice, 10e18);
    }

    function test_SupplyFor_SucceedsForSelf_NoOperatorNeeded() public {
        vm.startPrank(alice);
        wNVDAx.approve(address(market), type(uint256).max);
        vm.stopPrank();
        vm.prank(owner);
        wNVDAx.mint(alice, 10e18);

        vm.prank(alice);
        market.supplyFor(alice, 10e18);

        (uint256 collateral,) = market.getPosition(alice);
        assertEq(collateral, 10e18);
    }

    function test_SupplyFor_PullsFromCallerCreditsOnBehalfOf() public {
        vm.prank(alice);
        market.setOperator(zap, true);

        uint256 zapBalanceBefore = wNVDAx.balanceOf(zap);

        vm.prank(zap);
        market.supplyFor(alice, 10e18);

        (uint256 aliceCollateral,) = market.getPosition(alice);
        assertEq(aliceCollateral, 10e18, "position credited to alice, not zap");
        (uint256 zapCollateral,) = market.getPosition(zap);
        assertEq(zapCollateral, 0, "zap's own position untouched");
        assertEq(wNVDAx.balanceOf(zap), zapBalanceBefore - 10e18, "collateral pulled from the caller");
    }

    function test_SupplyFor_RevertsAfterOperatorRevoked() public {
        vm.prank(alice);
        market.setOperator(zap, true);
        vm.prank(alice);
        market.setOperator(zap, false);

        vm.prank(zap);
        vm.expectRevert(Market.NotAuthorized.selector);
        market.supplyFor(alice, 10e18);
    }

    function test_SupplyFor_RevertsWhenHalted() public {
        vm.prank(alice);
        market.setOperator(zap, true);
        vm.prank(owner);
        controller.beginHalting();

        vm.prank(zap);
        vm.expectRevert(Market.MarketHalted.selector);
        market.supplyFor(alice, 10e18);
    }

    // --- borrowFor -------------------------------------------------------

    function test_BorrowFor_RevertsWithoutAuthorization() public {
        vm.prank(zap);
        vm.expectRevert(Market.NotAuthorized.selector);
        market.borrowFor(alice, 100e18);
    }

    function test_BorrowFor_DebtOnOnBehalfOf_CashToCaller() public {
        vm.prank(alice);
        market.setOperator(zap, true);
        vm.prank(zap);
        market.supplyFor(alice, 10e18); // 10 wNVDAx @ 180 = 1,800 USDG value, 50% LTV -> max borrow 900

        uint256 zapUsdgBefore = usdg.balanceOf(zap);

        vm.prank(zap);
        market.borrowFor(alice, 500e18);

        (, uint256 aliceDebt) = market.getPosition(alice);
        assertEq(aliceDebt, 500e18, "debt recorded on alice, not zap");
        (, uint256 zapDebt) = market.getPosition(zap);
        assertEq(zapDebt, 0, "zap's own position carries no debt");
        assertEq(usdg.balanceOf(zap), zapUsdgBefore + 500e18, "borrowed cash sent to the caller");
    }

    function test_BorrowFor_RevertsAboveMaxLTV_UsingOnBehalfOfsCollateral() public {
        vm.prank(alice);
        market.setOperator(zap, true);
        vm.prank(zap);
        market.supplyFor(alice, 10e18); // max borrowable = 900e18

        vm.prank(zap);
        vm.expectRevert(Market.ExceedsMaxLTV.selector);
        market.borrowFor(alice, 901e18);
    }

    function test_BorrowFor_RevertsWhenHalted() public {
        vm.prank(alice);
        market.setOperator(zap, true);
        vm.prank(zap);
        market.supplyFor(alice, 10e18);
        vm.prank(owner);
        controller.beginHalting();

        vm.prank(zap);
        vm.expectRevert(Market.MarketHalted.selector);
        market.borrowFor(alice, 100e18);
    }

    function test_BorrowFor_RevertsAfterOperatorRevoked() public {
        vm.prank(alice);
        market.setOperator(zap, true);
        vm.prank(zap);
        market.supplyFor(alice, 10e18);
        vm.prank(alice);
        market.setOperator(zap, false);

        vm.prank(zap);
        vm.expectRevert(Market.NotAuthorized.selector);
        market.borrowFor(alice, 100e18);
    }

    // --- Existing supply()/borrow() unaffected --------------------------

    function test_Supply_StillWorksDirectlyWithoutAnyOperator() public {
        vm.prank(owner);
        wNVDAx.mint(alice, 10e18);
        vm.startPrank(alice);
        wNVDAx.approve(address(market), type(uint256).max);
        market.supply(10e18);
        vm.stopPrank();

        (uint256 collateral,) = market.getPosition(alice);
        assertEq(collateral, 10e18);
    }
}
