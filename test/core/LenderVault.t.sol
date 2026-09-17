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

/// @notice Proves LenderVault's ERC-4626 mechanics: share price reflects
/// Market's live interest accrual, withdrawals are capped at actual liquid
/// cash (not the full, partly-lent-out totalAssets), onlyMarket genuinely
/// gates borrowCash, and the one-time setMarket wiring can't be repointed.
contract LenderVaultTest is Test {
    Market market;
    HaltController controller;
    LenderVault vault;
    InterestRateModel irm;
    MockPausableOracle oracle;
    MockWrappedXStock wNVDAx;
    MockUSDG usdg;

    address owner = address(0xA11CE);
    address keeper = address(0xCAFE);
    address alice = address(0xA11CE0); // borrower
    address lp1 = address(0x1111);
    address lp2 = address(0x2222);

    uint256 constant NVDA_PRICE = 180e18;

    function setUp() public {
        vm.startPrank(owner);
        oracle = new MockPausableOracle(NVDA_PRICE, owner);
        wNVDAx = new MockWrappedXStock(owner);
        usdg = new MockUSDG(owner, 18);
        controller = new HaltController(address(oracle), owner, keeper);
        vault = new LenderVault(address(usdg), owner);
        irm = new InterestRateModel(1e18, 0, 0, 1e18, owner); // flat 100%/yr, for exact interest math
        market =
            new Market(address(wNVDAx), address(usdg), address(oracle), address(controller), address(vault), address(irm), owner, 0.5e18, 0.55e18, 0);
        vault.setMarket(address(market));

        usdg.mint(lp1, 1_000_000e18);
        usdg.mint(lp2, 1_000_000e18);
        wNVDAx.mint(alice, 100e18);
        vm.stopPrank();

        vm.prank(lp1);
        usdg.approve(address(vault), type(uint256).max);
        vm.prank(lp2);
        usdg.approve(address(vault), type(uint256).max);
        vm.startPrank(alice);
        wNVDAx.approve(address(market), type(uint256).max);
        usdg.approve(address(market), type(uint256).max);
        vm.stopPrank();
    }

    function test_FirstDeposit_MintsShares1to1() public {
        vm.prank(lp1);
        uint256 shares = vault.deposit(1_000e18, lp1);
        assertEq(shares, 1_000e18, "first depositor into an empty vault should get ~1:1 shares (OZ virtual-share offset is 0)");
    }

    function test_SecondDeposit_MintsProportionalShares() public {
        vm.prank(lp1);
        vault.deposit(1_000e18, lp1);
        vm.prank(lp2);
        uint256 shares = vault.deposit(500e18, lp2);
        assertApproxEqAbs(shares, 500e18, 1, "with no yield accrued yet, shares should still be ~1:1 with assets");
    }

    function test_Redeem_ReturnsExactlyWhatWasDeposited_WithNoInterest() public {
        vm.startPrank(lp1);
        uint256 shares = vault.deposit(1_000e18, lp1);
        uint256 assetsOut = vault.redeem(shares, lp1, lp1);
        vm.stopPrank();
        assertEq(assetsOut, 1_000e18);
    }

    function test_TotalAssets_IncludesOutstandingBorrowsAsInterestInclusive() public {
        vm.prank(lp1);
        vault.deposit(1_000e18, lp1);

        vm.startPrank(alice);
        market.supply(10e18); // value 1800, max borrow 900
        market.borrow(500e18);
        vm.stopPrank();

        // Cash left in the vault dropped, but totalAssets() must be unchanged
        // immediately after a borrow -- the value just moved from "cash" to
        // "owed by Market," not out of the vault's books entirely.
        assertEq(vault.totalAssets(), 1_000e18, "totalAssets must be conserved across a borrow with no time elapsed");
        assertEq(usdg.balanceOf(address(vault)), 500e18, "cash on hand should have dropped by exactly what was borrowed");

        vm.warp(block.timestamp + 365 days);
        // Now totalAssets() must have GROWN, purely from Market's pending
        // interest -- read live, with no transaction needed to "realize" it.
        assertGt(vault.totalAssets(), 1_000e18, "totalAssets must reflect accrued interest even without a prior accrueInterest() call");
    }

    function test_SharePrice_GrowsAsInterestAccrues_LpEarnsRealYield() public {
        vm.prank(lp1);
        uint256 shares = vault.deposit(1_000e18, lp1);

        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(500e18);
        vm.stopPrank();

        uint256 assetsBefore = vault.convertToAssets(shares);
        vm.warp(block.timestamp + 365 days);
        uint256 assetsAfter = vault.convertToAssets(shares);

        assertGt(assetsAfter, assetsBefore, "lp1's shares must be worth strictly more after a year of accrued interest");
    }

    function test_EndToEnd_LpRedeemsForMoreThanDeposited_AfterBorrowerRepaysWithInterest() public {
        // The actual product promise, proven fully end to end.
        vm.prank(lp1);
        vault.deposit(1_000e18, lp1);

        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(500e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);
        vm.prank(owner);
        oracle.setPrice(NVDA_PRICE); // keep the feed live through the time skip

        uint256 owed = market.currentDebt(alice);
        assertGt(owed, 500e18, "sanity: interest must have accrued");
        vm.prank(owner);
        usdg.mint(alice, owed - 500e18);
        vm.prank(alice);
        usdg.approve(address(market), owed);
        vm.prank(alice);
        market.repay(owed);

        uint256 lp1Shares = vault.balanceOf(lp1);
        vm.prank(lp1);
        uint256 redeemed = vault.redeem(lp1Shares, lp1, lp1);
        assertGt(redeemed, 1_000e18, "lp1 must receive strictly more than deposited -- this is the actual yield being paid out");
    }

    function test_MaxRedeem_CappedAtAvailableCash_NotFullShareBalance() public {
        vm.prank(lp1);
        uint256 shares = vault.deposit(1_000e18, lp1);

        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(900e18); // borrow almost everything
        vm.stopPrank();

        uint256 maxRedeemable = vault.maxRedeem(lp1);
        assertLt(maxRedeemable, shares, "with 900 of 1000 lent out, lp1 must not be able to redeem their full share balance");

        // Attempting to redeem beyond the cap must cleanly revert, not
        // attempt (and fail) a transfer of cash the vault doesn't have.
        vm.prank(lp1);
        vm.expectRevert();
        vault.redeem(shares, lp1, lp1);

        // But redeeming up to the cap must succeed.
        vm.prank(lp1);
        vault.redeem(maxRedeemable, lp1, lp1);
    }

    function test_MaxWithdraw_ComposesWithMaxRedeemOverride() public {
        vm.prank(lp1);
        vault.deposit(1_000e18, lp1);
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(900e18);
        vm.stopPrank();

        // 100 cash remains in the vault -- maxWithdraw must reflect that,
        // via the default implementation composing with the maxRedeem override.
        assertApproxEqAbs(vault.maxWithdraw(lp1), 100e18, 1);
    }

    function test_BorrowCash_OnlyMarket() public {
        vm.prank(lp1);
        vault.deposit(1_000e18, lp1);

        vm.expectRevert(LenderVault.OnlyMarket.selector);
        vault.borrowCash(alice, 100e18);
    }

    function test_SetMarket_CannotBeCalledTwice() public {
        vm.prank(owner);
        vm.expectRevert(LenderVault.MarketAlreadySet.selector);
        vault.setMarket(address(0xDEAD));
    }

    function test_SetMarket_RevertsOnZeroAddress() public {
        LenderVault freshVault = new LenderVault(address(usdg), owner);
        vm.prank(owner);
        vm.expectRevert(LenderVault.ZeroAddress.selector);
        freshVault.setMarket(address(0));
    }

    function test_SetMarket_OnlyOwner() public {
        LenderVault freshVault = new LenderVault(address(usdg), owner);
        vm.expectRevert();
        freshVault.setMarket(address(market));
    }

    // --- Halt-gating: found in a live audit that withdrawals had zero
    // HaltController awareness, letting LPs exit at a stale, frozen share
    // price during exactly the window a corporate action's outcome is
    // unresolved -- while every borrower-side action was correctly frozen.
    // maxRedeem() now reuses canLiquidate()'s exact OPEN-only condition. ---

    function test_MaxRedeem_IsZero_WhenHalted() public {
        vm.prank(lp1);
        vault.deposit(1_000e18, lp1);

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync(); // OPEN -> HALTED
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.HALTED));

        assertEq(vault.maxRedeem(lp1), 0, "no redemptions should be possible while halted, even with ample idle cash");
        assertEq(vault.maxWithdraw(lp1), 0, "maxWithdraw must reflect the same block via composition");
    }

    function test_Redeem_RevertsWhenHalted_EvenWithAmpleIdleCash() public {
        // The exact bank-run scenario: plenty of cash sitting idle (nobody
        // ever borrowed it), yet a halt must still block the exit -- the
        // point isn't liquidity, it's that the position's true value is
        // unresolved during the halt.
        vm.prank(lp1);
        uint256 shares = vault.deposit(1_000e18, lp1);
        assertEq(usdg.balanceOf(address(vault)), 1_000e18, "sanity: all of it is idle cash, nothing lent out");

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();

        vm.prank(lp1);
        vm.expectRevert();
        vault.redeem(shares, lp1, lp1);

        vm.prank(lp1);
        vm.expectRevert();
        vault.withdraw(500e18, lp1, lp1);
    }

    function test_MaxRedeem_IsZero_DuringHaltingAndResuming_NotJustHalted() public {
        // Matches canLiquidate()'s own OPEN-only bar exactly -- withdrawals
        // are blocked through the whole non-OPEN window, not just the
        // deepest part of it, since RESUMING still has liquidations paused
        // for the same "just-resumed data is dangerous" reason.
        vm.prank(lp1);
        vault.deposit(1_000e18, lp1);

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync(); // -> HALTED
        vm.prank(owner);
        oracle.resumeOracle(NVDA_PRICE);
        controller.sync(); // -> RESUMING
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.RESUMING));

        assertEq(vault.maxRedeem(lp1), 0, "resuming must still block withdrawals, matching canLiquidate()'s own bar");
    }

    function test_Deposit_StillAllowed_WhenHalted() public {
        // Deposits only ever add liquidity -- never a risk to anyone but the
        // depositor -- so they stay open throughout, same reasoning as
        // Market.repay() being always-allowed.
        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();

        vm.prank(lp1);
        uint256 shares = vault.deposit(1_000e18, lp1);
        assertGt(shares, 0, "deposits must still work while halted");
    }

    function test_MaxRedeem_RestoredAfterMarketReopens() public {
        vm.prank(lp1);
        uint256 shares = vault.deposit(1_000e18, lp1);

        vm.prank(owner);
        oracle.pauseOracle();
        controller.sync();
        assertEq(vault.maxRedeem(lp1), 0);

        vm.prank(owner);
        oracle.resumeOracle(NVDA_PRICE);
        controller.sync(); // -> RESUMING
        vm.prank(keeper);
        controller.completeResume(); // -> OPEN
        assertEq(uint8(controller.state()), uint8(HaltController.MarketState.OPEN));

        assertEq(vault.maxRedeem(lp1), shares, "full redemption must be available again once fully OPEN");
        vm.prank(lp1);
        vault.redeem(shares, lp1, lp1); // must not revert
    }

    function test_MultipleLPs_ShareYieldProportionally() public {
        vm.prank(lp1);
        vault.deposit(1_000e18, lp1); // lp1 in first, alone
        vm.startPrank(alice);
        market.supply(10e18);
        market.borrow(500e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 100 days);
        vm.prank(owner);
        oracle.setPrice(NVDA_PRICE);

        // lp2 deposits AFTER some yield has already accrued -- must be
        // priced in at the then-current (higher) share price, not the
        // original 1:1 rate, or lp2 would unfairly dilute lp1's accrued yield.
        vm.prank(lp2);
        uint256 lp2Shares = vault.deposit(1_000e18, lp2);
        assertLt(lp2Shares, 1_000e18, "lp2 must receive fewer shares per asset than lp1 did, since the share price has already risen");
    }
}
