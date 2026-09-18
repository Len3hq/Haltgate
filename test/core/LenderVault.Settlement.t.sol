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

/// @notice Covers what settlement actually unlocks: pro-rata redemption.
///
/// The freeze during a halt exists to stop a bank run -- LPs racing to exit
/// at a stale share price before bad debt is recognised. Simply lifting that
/// freeze after a timeout would hand the run straight back. So settlement
/// caps each holder at their proportional slice of cash instead, and these
/// tests are about proving that cap actually removes the incentive to race
/// rather than merely narrowing it.
contract LenderVaultSettlementTest is Test {
    Market market;
    HaltController controller;
    LenderVault vault;
    InterestRateModel irm;
    MockPausableOracle oracle;
    MockWrappedXStock wNVDAx;
    MockUSDG usdg;

    address owner = address(0xA11CE);
    address keeper = address(0xCAFE);
    address smallLp = address(0x5A11);
    address whaleLp = address(0x27A1E);
    address borrower = address(0xB0110);

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

        usdg.mint(smallLp, 1_000e18);
        usdg.mint(whaleLp, 9_000e18);
        wNVDAx.mint(borrower, 200e18);
        vm.stopPrank();

        vm.startPrank(smallLp);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(1_000e18, smallLp);
        vm.stopPrank();

        vm.startPrank(whaleLp);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(9_000e18, whaleLp);
        vm.stopPrank();

        // Borrow most of the cash out, so the pool is illiquid enough that
        // racing for the remainder would actually be worth doing.
        vm.startPrank(borrower);
        wNVDAx.approve(address(market), type(uint256).max);
        market.supply(120e18); // 120 * 180 = 21,600 value, 50% LTV -> 10,800 borrowable
        market.borrow(9_000e18);
        vm.stopPrank();

        // Let interest accrue while OPEN so the share price is meaningfully
        // above 1.0 -- a drift in redemption rate would otherwise be
        // invisible against a flat 1:1 price.
        vm.warp(block.timestamp + 30 days);
        market.accrueInterest();
    }

    function _settle() internal {
        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();
        vm.warp(block.timestamp + 8 days);
        controller.forceSettle();
        assertTrue(controller.isSettling());
    }

    // --- Settlement unlocks what the halt froze ---------------------------

    function test_RedemptionsAreFrozenWhileHalted_ThenUnlockOnSettlement() public {
        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();

        assertEq(vault.maxRedeem(whaleLp), 0, "frozen during the halt itself");

        vm.warp(block.timestamp + 8 days);
        controller.forceSettle();

        assertGt(vault.maxRedeem(whaleLp), 0, "settlement releases it");
    }

    function test_Settlement_RedemptionActuallySucceeds() public {
        _settle();
        uint256 before = usdg.balanceOf(whaleLp);

        uint256 shares = vault.maxRedeem(whaleLp);
        vm.prank(whaleLp);
        vault.redeem(shares, whaleLp, whaleLp);

        assertGt(usdg.balanceOf(whaleLp), before, "cash actually reached the lender");
    }

    // --- The anti-run property --------------------------------------------

    function test_Settlement_WhaleCannotDrainCashAheadOfSmallLp() public {
        _settle();
        uint256 cash = usdg.balanceOf(address(vault));

        uint256 whaleShares = vault.maxRedeem(whaleLp);
        uint256 whaleAssets = vault.previewRedeem(whaleShares);

        // The whale holds 90% of supply, so 90% of cash -- not all of it,
        // however fast they move.
        assertLt(whaleAssets, cash, "cannot take the whole pot");
        assertApproxEqRel(whaleAssets, (cash * 90) / 100, 0.01e18, "capped at their ~90% share");
    }

    function test_Settlement_SmallLpStillHasAClaimAfterWhaleExits() public {
        _settle();

        uint256 whaleShares = vault.maxRedeem(whaleLp);
        vm.prank(whaleLp);
        vault.redeem(whaleShares, whaleLp, whaleLp);

        // The freeze existed to stop exactly this from becoming impossible.
        assertGt(vault.maxRedeem(smallLp), 0, "small LP is not left with nothing withdrawable");
        assertGt(usdg.balanceOf(address(vault)), 0, "cash remains for them to draw on");
    }

    function test_Settlement_BeingLateCostsNothing_SameRateForBothLps() public {
        _settle();

        // Whale exits first.
        uint256 whaleShares = vault.maxRedeem(whaleLp);
        uint256 whaleBefore = usdg.balanceOf(whaleLp);
        vm.prank(whaleLp);
        vault.redeem(whaleShares, whaleLp, whaleLp);
        uint256 whaleRate = ((usdg.balanceOf(whaleLp) - whaleBefore) * 1e18) / whaleShares;

        // Small LP exits second, against a smaller remaining pot.
        uint256 smallShares = vault.maxRedeem(smallLp);
        uint256 smallBefore = usdg.balanceOf(smallLp);
        vm.prank(smallLp);
        vault.redeem(smallShares, smallLp, smallLp);
        uint256 smallRate = ((usdg.balanceOf(smallLp) - smallBefore) * 1e18) / smallShares;

        // If moving first paid better, the freeze would just have been
        // replaced by a slower-motion version of the same run.
        assertApproxEqRel(smallRate, whaleRate, 0.0001e18, "identical assets-per-share regardless of order");
    }

    function test_Settlement_SharePriceUnchangedByProRataRedemption() public {
        _settle();

        uint256 priceBefore = vault.convertToAssets(1e18);

        uint256 whaleShares = vault.maxRedeem(whaleLp);
        vm.prank(whaleLp);
        vault.redeem(whaleShares, whaleLp, whaleLp);

        // Cash and supply fall in step, so the remaining claim per share is
        // untouched. This invariant is the whole reason order stops mattering.
        assertApproxEqRel(vault.convertToAssets(1e18), priceBefore, 0.0001e18, "share price held flat");
    }

    function test_Settlement_RemainingShareholdersKeepProportionalClaim() public {
        _settle();

        uint256 whaleShares = vault.maxRedeem(whaleLp);
        vm.prank(whaleLp);
        vault.redeem(whaleShares, whaleLp, whaleLp);

        // The outstanding loans are still owed to whoever still holds shares,
        // in proportion -- not written off against the ones who waited.
        uint256 supply = vault.totalSupply();
        uint256 smallShare = (vault.balanceOf(smallLp) * 1e18) / supply;
        uint256 whaleShare = (vault.balanceOf(whaleLp) * 1e18) / supply;
        assertGt(smallShare, 0);
        assertGt(whaleShare, 0);
        assertApproxEqAbs(smallShare + whaleShare, 1e18, 1e12, "claims still sum to the whole pool");
    }

    function test_Settlement_RepaymentsFlowBackToRemainingHolders() public {
        _settle();

        uint256 claimableBefore = vault.maxRedeem(smallLp);

        // Borrowers can always repay, halt or not -- and that cash lands in
        // the vault, widening everyone's pro-rata entitlement.
        vm.startPrank(borrower);
        usdg.approve(address(market), type(uint256).max);
        vm.stopPrank();
        vm.prank(owner);
        usdg.mint(borrower, 5_000e18);
        vm.prank(borrower);
        market.repay(5_000e18);

        assertGt(vault.maxRedeem(smallLp), claimableBefore, "repaid cash widens the claim");
    }

    // --- Recovery ---------------------------------------------------------

    function test_Settlement_NormalRedemptionRulesReturnAfterRecovery() public {
        _settle();

        vm.prank(owner);
        oracle.resumeOracle(NVDA_PRICE);
        controller.sync();
        vm.prank(keeper);
        controller.completeResume();

        // Back to OPEN: capped by available cash, not by a pro-rata slice.
        uint256 cash = usdg.balanceOf(address(vault));
        uint256 whaleMax = vault.previewRedeem(vault.maxRedeem(whaleLp));
        assertApproxEqRel(whaleMax, cash, 0.0001e18, "whole liquid pot available again");
    }

    function test_Settlement_DepositsStillAllowed() public {
        _settle();
        vm.prank(owner);
        usdg.mint(smallLp, 100e18);

        vm.prank(smallLp);
        vault.deposit(100e18, smallLp);
        // Adding liquidity only ever helps, the same reasoning repay() relies on.
        assertGt(vault.balanceOf(smallLp), 0);
    }
}
