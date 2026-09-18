// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {WNVDAxFaucet} from "../../src/tokens/WNVDAxFaucet.sol";
import {MockWrappedXStock} from "../../src/tokens/MockWrappedXStock.sol";

contract WNVDAxFaucetTest is Test {
    WNVDAxFaucet faucet;
    MockWrappedXStock wNVDAx;

    address owner = address(0xA11CE);
    address alice = address(0xA11CE0);
    address bob = address(0xB0B);

    function setUp() public {
        vm.prank(owner);
        wNVDAx = new MockWrappedXStock("Mock Wrapped NVIDIA xStock", "wNVDAx-MOCK", owner);
        faucet = new WNVDAxFaucet(address(wNVDAx));

        vm.prank(owner);
        wNVDAx.mint(address(faucet), 10_000e18);
    }

    function test_Claim_TransfersFixedAmount() public {
        vm.prank(alice);
        faucet.claim();
        assertEq(wNVDAx.balanceOf(alice), faucet.CLAIM_AMOUNT());
    }

    function test_Claim_IsPermissionless_AnyoneCanCall() public {
        vm.prank(bob);
        faucet.claim();
        assertEq(wNVDAx.balanceOf(bob), faucet.CLAIM_AMOUNT());
    }

    function test_Claim_RevertsOnSecondAttempt() public {
        vm.startPrank(alice);
        faucet.claim();
        vm.expectRevert(WNVDAxFaucet.AlreadyClaimed.selector);
        faucet.claim();
        vm.stopPrank();
    }

    function test_Claim_DifferentAddressesEachGetOneClaim() public {
        vm.prank(alice);
        faucet.claim();
        vm.prank(bob);
        faucet.claim();
        assertEq(wNVDAx.balanceOf(alice), faucet.CLAIM_AMOUNT());
        assertEq(wNVDAx.balanceOf(bob), faucet.CLAIM_AMOUNT());
    }

    function test_Claim_RevertsWhenStockpileExhausted() public {
        WNVDAxFaucet smallFaucet = new WNVDAxFaucet(address(wNVDAx));
        vm.prank(owner);
        wNVDAx.mint(address(smallFaucet), 5e18); // less than one claim's worth

        vm.prank(alice);
        vm.expectRevert(); // SafeERC20 transfer failure -- honest, not a silent no-op
        smallFaucet.claim();
    }
}
