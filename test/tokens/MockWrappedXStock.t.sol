// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {MockWrappedXStock} from "../../src/tokens/MockWrappedXStock.sol";

contract MockWrappedXStockTest is Test {
    MockWrappedXStock token;
    address owner = address(0xA11CE);
    address stranger = address(0xB0B);
    address holder = address(0xCAFE);

    function setUp() public {
        token = new MockWrappedXStock(owner);
    }

    function test_InitialState() public view {
        assertEq(token.exchangeRate(), 1e18);
        assertEq(token.decimals(), 18);
        assertEq(token.symbol(), "wNVDAx-MOCK");
    }

    function test_Mint_OnlyOwner() public {
        vm.prank(owner);
        token.mint(holder, 10e18);
        assertEq(token.balanceOf(holder), 10e18);

        vm.prank(stranger);
        vm.expectRevert();
        token.mint(holder, 10e18);
    }

    function test_ValueOf_TracksExchangeRate() public {
        vm.prank(owner);
        token.mint(holder, 10e18);

        assertEq(token.valueOf(10e18), 10e18, "at 1:1 rate, value equals shares");

        vm.prank(owner);
        token.setExchangeRate(1.1e18); // simulates a dividend reinvestment bump

        assertEq(token.valueOf(10e18), 11e18, "value should scale with the new rate");
    }

    function test_BalanceNeverChangesOnExchangeRateUpdate() public {
        vm.prank(owner);
        token.mint(holder, 10e18);
        uint256 balanceBefore = token.balanceOf(holder);

        vm.startPrank(owner);
        token.setExchangeRate(1.1e18);
        token.setExchangeRate(0.9e18); // e.g. a split adjustment
        token.setExchangeRate(2e18);
        vm.stopPrank();

        assertEq(
            token.balanceOf(holder),
            balanceBefore,
            "balance must stay fixed across exchange-rate changes -- this is what makes it non-rebasing"
        );
    }

    function test_SetExchangeRate_OnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        token.setExchangeRate(2e18);
    }

    function test_Transfer_MovesFixedShares() public {
        vm.prank(owner);
        token.mint(holder, 10e18);

        vm.prank(holder);
        token.transfer(stranger, 4e18);

        assertEq(token.balanceOf(holder), 6e18);
        assertEq(token.balanceOf(stranger), 4e18);
    }
}
