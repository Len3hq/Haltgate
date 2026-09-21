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

/// @notice Property tests. The 305 unit tests only prove the cases somebody
/// thought to write down; these assert invariants across ranges instead.
/// Deliberately uses a 6-decimal debt token against 18-decimal collateral,
/// because the mixed-decimal conversions are where rounding bugs hide.
contract MarketFuzzTest is Test {
    Market market;
    HaltController controller;
    LenderVault vault;
    InterestRateModel irm;
    MockPausableOracle oracle;
    MockWrappedXStock coll;
    MockUSDG usdg;

    address owner = address(0xA11CE);
    address alice = address(0xA11CE0);
    address bob = address(0xB0B);
    address lp = address(0x11D);

    uint256 constant PRICE = 180e18;
    uint256 constant MAX_LTV = 0.5e18;
    uint256 constant LIQ_THRESHOLD = 0.55e18;

    function setUp() public {
        vm.startPrank(owner);
        oracle = new MockPausableOracle(PRICE, owner);
        coll = new MockWrappedXStock("Mock", "MOCK", owner);
        usdg = new MockUSDG(owner, 6); // 6 decimals, like real USDG
        controller = new HaltController(address(oracle), owner, owner);
        vault = new LenderVault(address(usdg), owner);
        irm = new InterestRateModel(0, 0.1e18, 3.0e18, 0.8e18, owner);
        market = new Market(
            address(coll), address(usdg), address(oracle), address(controller),
            address(vault), address(irm), owner, MAX_LTV, LIQ_THRESHOLD, 0.1e18
        );
        vault.setMarket(address(market));
        market.setFixedParams(0.35e18, 0.08e18);

        usdg.mint(lp, 1_000_000e6);
        usdg.mint(alice, 1_000_000e6);
        coll.mint(alice, 10_000e18);
        coll.mint(bob, 10_000e18);
        vm.stopPrank();

        vm.startPrank(lp);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(500_000e6, lp);
        vm.stopPrank();

        vm.startPrank(alice);
        coll.approve(address(market), type(uint256).max);
        usdg.approve(address(market), type(uint256).max);
        vm.stopPrank();
    }

    // --- Solvency -------------------------------------------------------

    /// Borrowing must never let a position exceed its own LTV ceiling, for
    /// any collateral amount, including ones whose 18->6 decimal conversion
    /// truncates.
    function testFuzz_BorrowNeverExceedsMaxLtv(uint256 collateralAmount) public {
        collateralAmount = bound(collateralAmount, 1e12, 1_000e18);

        vm.prank(alice);
        market.supply(collateralAmount);

        uint256 maxBorrow = (collateralAmount * PRICE / 1e18) * MAX_LTV / 1e18 / 1e12;
        if (maxBorrow == 0) return; // dust collateral cannot support any debt

        vm.prank(alice);
        market.borrow(maxBorrow);

        // At exactly the ceiling the position must still be safe.
        assertFalse(market.isLiquidatable(alice), "at-ceiling borrow must not be liquidatable");

        (, uint256 debt) = market.getPosition(alice);
        uint256 collateralValueWad = collateralAmount * PRICE / 1e18;
        assertLe(debt * 1e12, collateralValueWad * MAX_LTV / 1e18, "debt within LTV");
    }

    /// A supply/withdraw round trip must never return more collateral than
    /// went in. Any rounding has to favour the protocol.
    function testFuzz_SupplyWithdrawRoundTrip_NeverReturnsMore(uint256 amount) public {
        amount = bound(amount, 1, 10_000e18);
        uint256 before = coll.balanceOf(alice);

        vm.startPrank(alice);
        market.supply(amount);
        market.withdraw(amount);
        vm.stopPrank();

        assertLe(coll.balanceOf(alice), before, "round trip must not mint value");
    }

    /// The ERC-4626 round trip must never profit the depositor either.
    function testFuzz_DepositRedeemRoundTrip_NeverProfits(uint256 assets) public {
        assets = bound(assets, 1, 100_000e6);

        vm.startPrank(alice);
        usdg.approve(address(vault), type(uint256).max);
        uint256 before = usdg.balanceOf(alice);
        uint256 shares = vault.deposit(assets, alice);
        vault.redeem(shares, alice, alice);
        vm.stopPrank();

        assertLe(usdg.balanceOf(alice), before, "deposit/redeem must not mint value");
    }

    // --- Accounting integrity -------------------------------------------

    /// totalCollateral must equal the sum of every position's collateral.
    function testFuzz_TotalCollateralMatchesPositions(uint256 a, uint256 b) public {
        a = bound(a, 1e12, 1_000e18);
        b = bound(b, 1e12, 1_000e18);

        vm.prank(alice);
        market.supply(a);
        vm.startPrank(bob);
        coll.approve(address(market), type(uint256).max);
        market.supply(b);
        vm.stopPrank();

        (uint256 aColl,) = market.getPosition(alice);
        (uint256 bColl,) = market.getPosition(bob);
        assertEq(market.totalCollateral(), aColl + bColl, "totalCollateral must equal the sum");
        assertEq(coll.balanceOf(address(market)), market.totalCollateral(), "held balance must match the books");
    }

    // --- Liquidation ----------------------------------------------------

    /// However bad the position, a liquidation can never take more collateral
    /// than the position holds, nor more debt than the close factor allows.
    function testFuzz_LiquidationBoundedByPositionAndCloseFactor(uint256 repayAmount) public {
        vm.prank(alice);
        market.supply(10e18);
        vm.prank(alice);
        market.borrow(850e6); // near the 900 ceiling at $180 and 50%

        vm.prank(owner);
        oracle.setPrice(150e18); // drop until liquidatable
        vm.assume(market.isLiquidatable(alice));

        (uint256 collBefore, uint256 debtBefore) = market.getPosition(alice);
        repayAmount = bound(repayAmount, 1, debtBefore * 10);

        vm.startPrank(owner);
        usdg.mint(bob, repayAmount);
        vm.stopPrank();
        vm.startPrank(bob);
        usdg.approve(address(market), type(uint256).max);
        market.liquidate(alice, repayAmount);
        vm.stopPrank();

        (uint256 collAfter, uint256 debtAfter) = market.getPosition(alice);
        assertLe(collBefore - collAfter, collBefore, "cannot seize more than the position holds");
        assertGe(debtAfter, debtBefore - (debtBefore / 2) - 1, "close factor caps repayment at half");
    }

    // --- Fixed term -----------------------------------------------------

    /// Owed must rise with term and never fall below principal.
    function testFuzz_QuoteFixedMonotonicInTerm(uint256 principal, uint256 t1, uint256 t2) public view {
        principal = bound(principal, 1e6, 1_000_000e6);
        t1 = bound(t1, 1 days, 30 days);
        t2 = bound(t2, t1, 30 days);

        uint256 owed1 = market.quoteFixed(principal, t1);
        uint256 owed2 = market.quoteFixed(principal, t2);

        assertGe(owed1, principal, "owed never below principal");
        assertGe(owed2, owed1, "longer term never cheaper");
    }

    /// The invariant the audit added a guard for, asserted across ranges.
    function testFuzz_FixedLtvNeverExceedsMaxLtv(uint256 newMax, uint256 newFixed) public {
        newMax = bound(newMax, 0.05e18, 0.9e18);
        newFixed = bound(newFixed, 0.01e18, 0.95e18);

        vm.startPrank(owner);
        // Lower the fixed LTV out of the way first. This ordering is forced by
        // the guard itself: setRiskParams refuses to drop maxLTV beneath the
        // standing fixedMaxLTV, which the fuzzer found immediately.
        market.setFixedParams(0.01e18, 0.08e18);
        market.setRiskParams(newMax, newMax + 0.05e18 > 1e18 ? 1e18 : newMax + 0.05e18);

        if (newFixed > newMax) {
            vm.expectRevert(Market.InvalidFixedParams.selector);
            market.setFixedParams(newFixed, 0.08e18);
        } else {
            market.setFixedParams(newFixed, 0.08e18);
        }
        vm.stopPrank();

        // Whichever branch ran, the invariant must hold afterwards.
        assertLe(market.fixedMaxLTV(), market.maxLTV(), "fixed LTV never exceeds variable");
    }
}
