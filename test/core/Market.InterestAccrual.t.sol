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

/// @notice Proves the borrow-index interest accrual is correct end to end:
/// debt actually grows over time, view functions reflect it even without a
/// prior touch (the failure mode that matters -- an understated health
/// factor is a solvency bug, not a display quirk), multiple borrowers stay
/// consistent against the shared global index, reserveFactor genuinely
/// splits interest between lenders and the protocol, and idle periods with
/// zero outstanding debt never apply phantom interest.
contract MarketInterestAccrualTest is Test {
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
    address bob = address(0xB0B);
    address lp = address(0x1111);

    uint256 constant NVDA_PRICE = 180e18;
    uint256 constant MAX_LTV = 0.5e18;
    uint256 constant LIQ_THRESHOLD = 0.55e18;
    // A deliberately large, round rate so accrual effects are easy to
    // reason about exactly, instead of chasing tiny real-world APYs through
    // rounding: 100%/year base rate, flat (no slope), no kink effect at the
    // utilizations these tests stay under.
    uint256 constant FLAT_RATE_PER_YEAR = 1e18;

    function setUp() public {
        vm.startPrank(owner);
        oracle = new MockPausableOracle(NVDA_PRICE, owner);
        wNVDAx = new MockWrappedXStock(owner);
        usdg = new MockUSDG(owner, 18);
        controller = new HaltController(address(oracle), owner, keeper);
        vault = new LenderVault(address(usdg), owner);
        irm = new InterestRateModel(FLAT_RATE_PER_YEAR, 0, 0, 1e18, owner);
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

        usdg.mint(lp, 1_000_000e18);
        wNVDAx.mint(alice, 100e18);
        wNVDAx.mint(bob, 100e18);
        vm.stopPrank();

        vm.prank(lp);
        usdg.approve(address(vault), type(uint256).max);
        vm.prank(lp);
        vault.deposit(1_000_000e18, lp);

        vm.startPrank(alice);
        wNVDAx.approve(address(market), type(uint256).max);
        usdg.approve(address(market), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(bob);
        wNVDAx.approve(address(market), type(uint256).max);
        usdg.approve(address(market), type(uint256).max);
        vm.stopPrank();
    }

    function test_NoBorrows_AccrueInterest_IsNoOp() public {
        vm.warp(block.timestamp + 365 days);
        market.accrueInterest();
        assertEq(market.totalBorrows(), 0);
        assertEq(market.borrowIndex(), 1e18, "index must not move with nothing borrowed");
    }

    function test_Debt_GrowsOverTime_AtExpectedRate() public {
        vm.startPrank(alice);
        market.supply(20e18); // value 3600, max borrow 1800 -- room for 1000 principal to grow
        market.borrow(1_000e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);
        uint256 debt = market.currentDebt(alice);
        // 100%/year flat rate for exactly one year -- debt should have
        // doubled, modulo the linear-per-tick approximation (one tick here,
        // so this IS exact simple interest, not compounded).
        assertApproxEqRel(debt, 2_000e18, 0.001e18, "one year at 100% flat APY should roughly double the debt");
        assertGt(debt, 1_000e18, "sanity: debt must have grown at all");
    }

    function test_HealthFactor_ReflectsPendingInterest_WithoutAnyPriorTouch() public {
        // The critical safety property: nobody has to call anything for
        // health checks to be accurate. If this were wrong, a position
        // could look safe from outside while actually being undercollateralized.
        vm.startPrank(alice);
        market.supply(10e18); // value 1800, borrow near the edge
        market.borrow(890e18); // safely under the 900 max at t=0
        vm.stopPrank();

        uint256 hfBefore = market.healthFactor(alice);
        assertFalse(market.isLiquidatable(alice));

        // Let a lot of interest accrue -- nobody touches the position or the market.
        vm.warp(block.timestamp + 200 days);

        uint256 hfAfter = market.healthFactor(alice);
        assertLt(hfAfter, hfBefore, "health factor must drop as interest silently grows debt");
        // 200 days at 100%/yr flat is enough to push 890 well past the 900
        // liquidation-threshold-implied ceiling (990 at 55%) with zero price movement.
        assertTrue(market.isLiquidatable(alice), "pure interest growth, with no price change, must be able to trigger liquidatability");
    }

    function test_CurrentDebt_View_MatchesActualDebtAfterRealTransaction() public {
        vm.startPrank(alice);
        market.supply(20e18);
        market.borrow(1_000e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);
        uint256 viewedDebt = market.currentDebt(alice);

        // Force a real accrual-triggering write (a 1-wei repay) and confirm
        // the position's on-chain principal now matches what the view
        // predicted beforehand.
        vm.prank(owner);
        usdg.mint(alice, 1);
        vm.prank(alice);
        usdg.approve(address(market), 1);
        vm.prank(alice);
        market.repay(1);

        (, uint256 debtNative,) = market.positions(alice);
        assertApproxEqAbs(debtNative + 1, viewedDebt, 1, "view-predicted debt must match what the real accrual actually wrote, within rounding");
    }

    function test_MultipleBorrowers_StayConsistentAgainstSharedIndex() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(500e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 50 days);
        vm.prank(owner);
        oracle.setPrice(NVDA_PRICE); // keep the feed live through the time skip, same as a real oracle would be

        // Bob borrows AFTER interest has already accrued once -- his
        // position must start from a fresh snapshot, not retroactively
        // owe interest for the period before he ever borrowed.
        vm.startPrank(bob);
        market.supply(10e18);
        market.borrow(500e18);
        vm.stopPrank();

        assertEq(market.currentDebt(bob), 500e18, "bob's debt must not include interest accrued before he borrowed");
        assertGt(market.currentDebt(alice), 500e18, "alice's debt must include the interest that accrued while only she had a loan");

        vm.warp(block.timestamp + 50 days);

        // From here on both accrue together -- the growth ratio since this
        // point should be identical for both, since they share one index.
        uint256 aliceBefore = market.currentDebt(alice);
        uint256 bobBefore = market.currentDebt(bob);
        vm.warp(block.timestamp + 50 days);
        uint256 aliceAfter = market.currentDebt(alice);
        uint256 bobAfter = market.currentDebt(bob);

        // (aliceAfter / aliceBefore) == (bobAfter / bobBefore), compared via
        // cross-multiplication to stay in integer math.
        assertApproxEqRel(aliceAfter * bobBefore, bobAfter * aliceBefore, 0.0001e18, "both positions must grow by the same multiplicative factor over the same window");
    }

    function test_TotalBorrows_MatchesSumOfIndividualDebts() public {
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(500e18);
        vm.stopPrank();
        vm.startPrank(bob);
        market.supply(10e18);
        market.borrow(300e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 90 days);
        market.accrueInterest();

        uint256 sumOfDebts = market.currentDebt(alice) + market.currentDebt(bob);
        assertApproxEqAbs(market.totalBorrows(), sumOfDebts, 2, "global totalBorrows must track the sum of individual positions, modulo per-position rounding");
    }

    function test_ReserveFactor_SplitsInterestBetweenLendersAndReserves() public {
        vm.prank(owner);
        market.setReserveFactor(0.2e18); // 20% of interest kept as reserves

        vm.startPrank(alice);
        market.supply(20e18);
        market.borrow(1_000e18);
        vm.stopPrank();

        uint256 sharesLpHeld = vault.balanceOf(lp);
        uint256 lpAssetsBefore = vault.convertToAssets(sharesLpHeld);

        vm.warp(block.timestamp + 365 days);
        market.accrueInterest();

        uint256 interestAccrued = market.totalBorrows() - 1_000e18;
        assertApproxEqAbs(market.totalReserves(), (interestAccrued * 0.2e18) / 1e18, 2, "reserves must be exactly reserveFactor's cut of accrued interest");

        uint256 lpAssetsAfter = vault.convertToAssets(sharesLpHeld);
        uint256 lpGain = lpAssetsAfter - lpAssetsBefore;
        uint256 expectedLpGain = (interestAccrued * 0.8e18) / 1e18; // the other 80%
        assertApproxEqRel(lpGain, expectedLpGain, 0.001e18, "LP's share value must grow by exactly the non-reserved portion of interest");
    }

    function test_LongIdlePeriod_WithNoBorrows_AppliesNoPhantomInterestOnFirstBorrow() public {
        // A year passes with zero borrows outstanding, THEN someone borrows
        // for the first time -- must not retroactively charge a year of
        // interest on debt that didn't exist yet.
        vm.warp(block.timestamp + 365 days);
        vm.prank(owner);
        oracle.setPrice(NVDA_PRICE); // real feed stays live even when nobody's borrowed

        vm.startPrank(alice);
        market.supply(20e18);
        market.borrow(1_000e18);
        vm.stopPrank();

        assertEq(market.currentDebt(alice), 1_000e18, "freshly borrowed debt must equal principal exactly -- no backdated interest");
    }

    function test_FullRepay_StopsFurtherAccrualOnThatPosition() public {
        vm.startPrank(alice);
        market.supply(20e18);
        market.borrow(1_000e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);
        uint256 owed = market.currentDebt(alice);
        vm.prank(owner);
        usdg.mint(alice, owed - 1_000e18);
        vm.prank(alice);
        usdg.approve(address(market), owed);
        vm.prank(alice);
        market.repay(owed);

        assertEq(market.currentDebt(alice), 0, "fully repaid position must show zero debt immediately");

        vm.warp(block.timestamp + 365 days);
        assertEq(market.currentDebt(alice), 0, "a zero-principal position must never accrue interest again");
    }

    function test_SetReserveFactor_RevertsAboveHardCeiling() public {
        vm.prank(owner);
        vm.expectRevert(Market.InvalidReserveFactor.selector);
        market.setReserveFactor(0.51e18); // above the 50% MAX_RESERVE_FACTOR ceiling
    }

    function test_SetReserveFactor_OnlyOwner() public {
        vm.expectRevert();
        market.setReserveFactor(0.1e18);
    }

    function test_WithdrawReserves_RespectsAccruedReservesCap() public {
        vm.prank(owner);
        market.setReserveFactor(0.5e18);
        vm.startPrank(alice);
        market.supply(20e18);
        market.borrow(1_000e18);
        vm.stopPrank();
        vm.warp(block.timestamp + 365 days);
        market.accrueInterest();

        uint256 reserves = market.totalReserves();
        vm.prank(owner);
        vm.expectRevert(Market.InsufficientReserves.selector);
        market.withdrawReserves(owner, reserves + 1);

        vm.prank(owner);
        market.withdrawReserves(owner, reserves);
        assertEq(market.totalReserves(), 0);
        assertEq(usdg.balanceOf(owner), reserves);
    }

    function test_WithdrawReserves_OnlyOwner() public {
        vm.expectRevert();
        market.withdrawReserves(alice, 1);
    }

    function test_SetInterestRateModel_SettlesInterestUnderOldModelFirst() public {
        vm.startPrank(alice);
        market.supply(20e18);
        market.borrow(1_000e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);
        uint256 debtUnderOldModel = market.currentDebt(alice);

        InterestRateModel zeroRateIrm = new InterestRateModel(0, 0, 0, 0.8e18, owner);
        vm.prank(owner);
        market.setInterestRateModel(address(zeroRateIrm));

        // Debt at the moment of the switch must equal what the OLD model
        // had accrued -- not reset, not double-counted.
        assertApproxEqAbs(market.currentDebt(alice), debtUnderOldModel, 2);

        // And from here on, the new (zero-rate) model means no further growth.
        vm.warp(block.timestamp + 365 days);
        assertApproxEqAbs(market.currentDebt(alice), debtUnderOldModel, 2, "zero-rate model must halt further accrual");
    }

    // --- BUILD.md §6 edge case 5: "Interest accrual during halt -- Freeze
    // the interest index during HALTED -- disclose this rather than
    // silently accruing." Never tested until now; accrueInterest() had no
    // halt-awareness at all before this fix. ---

    function test_InterestFrozen_DuringHalt() public {
        vm.startPrank(alice);
        market.supply(20e18);
        market.borrow(1_000e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 10 days);
        assertGt(market.currentDebt(alice), 1_000e18, "sanity: interest accrues normally before any halt");

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync(); // OPEN -> HALTED (permissionless, mirrors the rest of the suite)
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.HALTED), "sanity: market must actually be halted");

        market.accrueInterest(); // settle up to the instant of the halt
        uint256 debtAtHaltStart = market.currentDebt(alice);

        vm.warp(block.timestamp + 100 days); // a long halt
        assertEq(market.currentDebt(alice), debtAtHaltStart, "debt must not grow at all while HALTED (view path)");

        market.accrueInterest(); // a real write, not just a view -- must still be a no-op
        assertEq(market.currentDebt(alice), debtAtHaltStart, "a real accrueInterest() call during HALTED must not move the index");
    }

    function test_InterestResumes_AfterHaltEnds() public {
        vm.startPrank(alice);
        market.supply(20e18);
        market.borrow(1_000e18);
        vm.stopPrank();

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync(); // OPEN -> HALTED
        market.accrueInterest();
        uint256 debtDuringHalt = market.currentDebt(alice);

        vm.warp(block.timestamp + 50 days);
        assertEq(market.currentDebt(alice), debtDuringHalt, "frozen throughout the halt");

        vm.prank(owner);
        oracle.resumeOracle(NVDA_PRICE);
        controller.sync(); // HALTED -> RESUMING
        vm.prank(keeper);
        controller.completeResume(); // RESUMING -> OPEN
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.OPEN));

        vm.warp(block.timestamp + 10 days);
        assertGt(market.currentDebt(alice), debtDuringHalt, "interest must resume accruing once the market reopens");
    }

    function test_HealthFactor_DoesNotWorsen_WhileHalted_FromInterestAlone() public {
        // The safety-relevant flip side of the freeze: a position that was
        // borderline-safe right before a halt must not drift into
        // liquidatable territory purely from interest ticking while the
        // borrower has no way to react (no new borrow/supply, price frozen too).
        vm.startPrank(alice);
        market.supply(20e18); // value 3600, max borrow 1800
        market.borrow(1_780e18); // just under the max, close to the edge
        vm.stopPrank();

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.HALTED));

        uint256 hfAtHaltStart = market.healthFactor(alice);
        assertFalse(market.isLiquidatable(alice));

        vm.warp(block.timestamp + 300 days); // a very long halt
        assertEq(market.healthFactor(alice), hfAtHaltStart, "health factor must not move at all from interest while frozen");
        assertFalse(market.isLiquidatable(alice), "must not become liquidatable purely from a frozen index");
    }

    function test_PendingBorrowsAndReserves_AlsoFreezes_DuringHalt() public {
        // The vault's share price derives from this view -- if it didn't
        // freeze too, LPs would see (and could exploit) a moving valuation
        // during a halt even though borrower debt itself is frozen.
        vm.startPrank(alice);
        market.supply(20e18);
        market.borrow(1_000e18);
        vm.stopPrank();

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();
        market.accrueInterest();
        (uint256 borrowsAtHaltStart, uint256 reservesAtHaltStart) = market.pendingBorrowsAndReserves();

        vm.warp(block.timestamp + 60 days);
        (uint256 borrowsLater, uint256 reservesLater) = market.pendingBorrowsAndReserves();
        assertEq(borrowsLater, borrowsAtHaltStart, "totalBorrows must not drift during a halt");
        assertEq(reservesLater, reservesAtHaltStart, "totalReserves must not drift during a halt either");
    }

    // --- Reproduces a real bug found during audit: lpOwedBorrowsView() used
    // to subtract totalReserves from totalBorrows in isolation, which
    // underflows the instant a full repayment drops totalBorrows below
    // totalReserves (reserves funded by interest already collected, now
    // sitting in cash instead). Since LenderVault.totalAssets() depended on
    // it, this would have permanently bricked every vault deposit/withdraw
    // the first time a borrower's debt was fully repaid after any interest
    // had accrued. Fixed by computing cash + totalBorrows - totalReserves as
    // one left-to-right expression in the vault instead. ---
    function test_VaultRemainsUsable_AfterFullRepayDrainsBorrowsBelowReserves() public {
        vm.prank(owner);
        market.setReserveFactor(0.1e18);

        vm.startPrank(alice);
        market.supply(20e18);
        market.borrow(1_000e18); // borrows all available vault liquidity
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);
        uint256 owed = market.currentDebt(alice);

        vm.prank(owner);
        usdg.mint(alice, owed - 1_000e18);
        vm.prank(alice);
        usdg.approve(address(market), owed);
        vm.prank(alice);
        market.repay(owed); // full repayment -- totalBorrows drops to (near) zero

        assertEq(market.totalBorrows(), 0, "sanity: fully repaid");
        assertGt(market.totalReserves(), 0, "sanity: reserves accrued and were never touched by the repay");

        // Must not revert, and must return a sane value reflecting the true
        // combined pool value minus the protocol's reserve claim.
        (uint256 pendingBorrows, uint256 pendingReserves) = market.pendingBorrowsAndReserves();
        assertEq(pendingBorrows, 0);
        assertGt(pendingReserves, 0);

        // The vault must still be fully usable -- this is the actual
        // regression check: every deposit/withdraw depends on totalAssets(),
        // which depends on exactly this arithmetic.
        uint256 totalAssetsBefore = vault.totalAssets();
        assertGt(totalAssetsBefore, 0);

        vm.prank(owner);
        usdg.mint(lp, 100e18);
        vm.prank(lp);
        usdg.approve(address(vault), 100e18);
        vm.prank(lp);
        vault.deposit(100e18, lp); // must not revert
        assertEq(vault.totalAssets(), totalAssetsBefore + 100e18);
    }
}
