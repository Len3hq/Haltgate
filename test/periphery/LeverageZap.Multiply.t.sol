// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {Market} from "../../src/core/Market.sol";
import {HaltController} from "../../src/core/HaltController.sol";
import {LenderVault} from "../../src/core/LenderVault.sol";
import {InterestRateModel} from "../../src/core/InterestRateModel.sol";
import {SwapModule} from "../../src/periphery/SwapModule.sol";
import {LeverageZap} from "../../src/periphery/LeverageZap.sol";
import {MockPausableOracle} from "../../src/oracle/MockPausableOracle.sol";
import {MockWrappedXStock} from "../../src/tokens/MockWrappedXStock.sol";
import {MockUSDG} from "../../src/tokens/MockUSDG.sol";

/// @notice Covers LeverageZap.multiply() -- the looped, target-multiple
/// variant (BUILD.md §11 Milestone 2). The single-pass leverage() path has
/// its own suite in LeverageZap.t.sol.
contract LeverageZapMultiplyTest is Test {
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
    uint256 constant MAX_LTV = 0.5e18; // caps achievable leverage at 1/(1-0.5) = 2x
    uint256 constant LIQ_THRESHOLD = 0.55e18;
    uint256 constant SWAP_FEE = 0.003e18;
    uint256 constant INITIAL_LIQUIDITY = 1_000_000e18;

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

        usdg.mint(owner, INITIAL_LIQUIDITY);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(INITIAL_LIQUIDITY, owner);

        wNVDAx.mint(address(swap), 100_000e18); // deep swap inventory -- not the constraint under test
        wNVDAx.mint(alice, 100e18);
        vm.stopPrank();

        vm.startPrank(alice);
        wNVDAx.approve(address(zap), type(uint256).max);
        market.setOperator(address(zap), true);
        vm.stopPrank();
    }

    // --- Reaching the target --------------------------------------------

    function test_Multiply_ReachesTargetLeverage() public {
        vm.prank(alice);
        zap.multiply(market, swap, 10e18, 1.5e18, 0);

        (uint256 collateral, uint256 debt) = market.getPosition(alice);
        // 10 wNVDAx base, 1.5x target -> ~15 wNVDAx of collateral.
        assertApproxEqAbs(collateral, 15e18, 1e13, "target leverage reached");
        assertGt(debt, 0, "debt was taken on to get there");
    }

    function test_Multiply_DoesNotOvershootTarget() public {
        vm.prank(alice);
        zap.multiply(market, swap, 10e18, 1.5e18, 0);

        (uint256 collateral,) = market.getPosition(alice);
        // A pass rounds its borrow up by one wei of debt so it can actually
        // close the gap, so allow a dust band -- but never a meaningful
        // overshoot, which would mean more risk than the caller asked for.
        assertLe(collateral, 15e18 + 1e13, "never meaningfully past the requested multiple");
    }

    function test_Multiply_LowerTargetTakesFewerLoops_StillAccurate() public {
        vm.prank(alice);
        zap.multiply(market, swap, 10e18, 1.2e18, 0);

        (uint256 collateral,) = market.getPosition(alice);
        assertApproxEqAbs(collateral, 12e18, 1e13);
    }

    // --- Stopping early rather than reverting ----------------------------

    function test_Multiply_StopsShortOfLtvAsymptote_WithoutReverting() public {
        // 2x is exactly the theoretical ceiling at a 50% maxLTV -- an
        // asymptote no finite number of loops ever reaches. Must degrade
        // gracefully, not revert.
        vm.prank(alice);
        zap.multiply(market, swap, 10e18, 2e18, 0);

        (uint256 collateral,) = market.getPosition(alice);
        assertLt(collateral, 20e18, "cannot actually reach the asymptote");
        assertGt(collateral, 19e18, "but gets close to it");
        assertFalse(market.isLiquidatable(alice), "and lands in a safe position, not an instantly-liquidatable one");
    }

    function test_Multiply_StopsEarlyWhenVaultLiquidityIsThin() public {
        // Drain the vault down to a sliver so liquidity, not LTV, is what
        // stops the loop.
        vm.prank(owner);
        vault.withdraw(INITIAL_LIQUIDITY - 100e18, owner, owner);

        vm.prank(alice);
        zap.multiply(market, swap, 10e18, 1.5e18, 0);

        (uint256 collateral, uint256 debt) = market.getPosition(alice);
        assertLt(collateral, 15e18, "stopped short of target -- vault ran out of cash");
        assertGt(collateral, 10e18, "but still levered up with what was available");
        assertEq(debt, 100e18, "borrowed exactly the cash that existed, no more");
    }

    function test_Multiply_RevertsIfResultBelowMinFinalCollateral() public {
        vm.prank(owner);
        vault.withdraw(INITIAL_LIQUIDITY - 100e18, owner, owner);

        // Caller insists on a full 1.5x; thin liquidity can't deliver it.
        vm.prank(alice);
        vm.expectRevert(LeverageZap.SlippageTooHigh.selector);
        zap.multiply(market, swap, 10e18, 1.5e18, 15e18);
    }

    // --- Input bounds ----------------------------------------------------

    function test_Multiply_RevertsAboveMaxLeverage() public {
        uint256 tooHigh = zap.MAX_LEVERAGE() + 1;
        vm.prank(alice);
        vm.expectRevert(LeverageZap.InvalidLeverage.selector);
        zap.multiply(market, swap, 10e18, tooHigh, 0);
    }

    function test_Multiply_RevertsAtExactly1x() public {
        vm.prank(alice);
        vm.expectRevert(LeverageZap.InvalidLeverage.selector);
        zap.multiply(market, swap, 10e18, 1e18, 0);
    }

    function test_Multiply_RevertsBelow1x() public {
        vm.prank(alice);
        vm.expectRevert(LeverageZap.InvalidLeverage.selector);
        zap.multiply(market, swap, 10e18, 0.5e18, 0);
    }

    // --- Authorization and halt gating -----------------------------------

    function test_Multiply_RevertsWithoutOperatorAuthorization() public {
        vm.prank(alice);
        market.setOperator(address(zap), false);

        vm.prank(alice);
        vm.expectRevert(Market.NotAuthorized.selector);
        zap.multiply(market, swap, 10e18, 1.5e18, 0);
    }

    function test_Multiply_RevertsWhenHalted() public {
        vm.prank(owner);
        controller.beginHalting();

        vm.prank(alice);
        vm.expectRevert(Market.MarketHalted.selector);
        zap.multiply(market, swap, 10e18, 1.5e18, 0);
    }

    function test_Multiply_RevertsOnMismatchedSwapModule() public {
        vm.startPrank(owner);
        MockWrappedXStock otherCollateral = new MockWrappedXStock(owner);
        SwapModule mismatched =
            new SwapModule(address(otherCollateral), address(usdg), address(oracle), address(controller), SWAP_FEE, owner);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(LeverageZap.MismatchedSwapModule.selector);
        zap.multiply(market, mismatched, 10e18, 1.5e18, 0);
    }

    // --- Position integrity ----------------------------------------------

    function test_Multiply_CreditsUserNotZap_AndLeavesNoResidue() public {
        vm.prank(alice);
        zap.multiply(market, swap, 10e18, 1.5e18, 0);

        (uint256 zapCollateral, uint256 zapDebt) = market.getPosition(address(zap));
        assertEq(zapCollateral, 0, "zap owns no position");
        assertEq(zapDebt, 0, "zap carries no debt");
        assertEq(wNVDAx.balanceOf(address(zap)), 0, "no collateral left behind");
        assertEq(usdg.balanceOf(address(zap)), 0, "no debt token left behind");
    }

    function test_Multiply_PositionStaysWithinMaxLtv() public {
        vm.prank(alice);
        zap.multiply(market, swap, 10e18, 1.9e18, 0);

        assertFalse(market.isLiquidatable(alice));
        assertGt(market.healthFactor(alice), 1e18, "health factor stays above liquidation");
    }

    function test_Multiply_ZeroInitial_AmplifiesExistingPosition() public {
        vm.startPrank(alice);
        wNVDAx.approve(address(market), type(uint256).max);
        market.supply(10e18); // already holds a position, supplied directly
        vm.stopPrank();

        vm.prank(alice);
        zap.multiply(market, swap, 0, 1.5e18, 0);

        (uint256 collateral,) = market.getPosition(alice);
        assertApproxEqAbs(collateral, 15e18, 1e13);
    }

    function test_Multiply_EmitsEventWithLoopCount() public {
        vm.recordLogs();
        vm.prank(alice);
        zap.multiply(market, swap, 10e18, 1.5e18, 0);

        // Multiplied is the last event this call emits.
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 sig = keccak256("Multiplied(address,address,uint256,uint256,uint256,uint256)");
        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == sig) {
                (uint256 initialIn, uint256 totalBorrowed, uint256 finalCollateral, uint256 loops) =
                    abi.decode(logs[i].data, (uint256, uint256, uint256, uint256));
                assertEq(initialIn, 10e18);
                assertGt(totalBorrowed, 0);
                assertApproxEqAbs(finalCollateral, 15e18, 1e13);
                assertGt(loops, 0, "at least one loop ran");
                assertLe(loops, 10, "within the iteration bound");
                found = true;
            }
        }
        assertTrue(found, "Multiplied event emitted");
    }
}
