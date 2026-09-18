// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Market} from "../../src/core/Market.sol";
import {HaltController} from "../../src/core/HaltController.sol";
import {LenderVault} from "../../src/core/LenderVault.sol";
import {InterestRateModel} from "../../src/core/InterestRateModel.sol";
import {MockPausableOracle} from "../../src/oracle/MockPausableOracle.sol";
import {MockWrappedXStock} from "../../src/tokens/MockWrappedXStock.sol";

/// @notice Standard OZ ERC20 has no recipient callback, so neither of our
/// real mocks can actually exercise a reentrancy path -- this token
/// deliberately simulates a hook-bearing debt token (e.g. an ERC777-style
/// asset, or any token with unusual transfer logic) to prove nonReentrant
/// actually blocks a reentrant call, rather than trusting the modifier is
/// wired correctly without ever having triggered it.
contract MaliciousReentrantToken is ERC20 {
    Market public target;
    bool public attackArmed;

    constructor() ERC20("Malicious", "EVIL") {
        _mint(msg.sender, 1_000_000e18);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function setTarget(Market target_) external {
        target = target_;
    }

    function armAttack() external {
        attackArmed = true;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        bool ok = super.transfer(to, amount);
        if (attackArmed) {
            attackArmed = false; // avoid infinite recursion
            target.borrow(1); // attempt to re-enter mid-transfer
        }
        return ok;
    }
}

contract MarketReentrancyTest is Test {
    Market market;
    HaltController controller;
    LenderVault vault;
    InterestRateModel irm;
    MockPausableOracle oracle;
    MockWrappedXStock wNVDAx;
    MaliciousReentrantToken evilUsdg;

    address owner = address(0xA11CE);
    address keeper = address(0xCAFE);
    address attacker = address(0xBAD);

    function setUp() public {
        vm.startPrank(owner);
        oracle = new MockPausableOracle(180e18, owner);
        wNVDAx = new MockWrappedXStock("Mock Wrapped NVIDIA xStock", "wNVDAx-MOCK", owner);
        evilUsdg = new MaliciousReentrantToken();
        controller = new HaltController(address(oracle), owner, keeper);
        vault = new LenderVault(address(evilUsdg), owner);
        irm = new InterestRateModel(0, 0.1e18, 3.0e18, 0.8e18, owner);
        market = new Market(
            address(wNVDAx), address(evilUsdg), address(oracle), address(controller), address(vault), address(irm), owner, 0.5e18, 0.55e18, 0
        );
        vault.setMarket(address(market));
        evilUsdg.setTarget(market);

        evilUsdg.approve(address(vault), type(uint256).max);
        vault.deposit(100_000e18, owner);

        wNVDAx.mint(attacker, 100e18);
        vm.stopPrank();

        vm.prank(attacker);
        wNVDAx.approve(address(market), type(uint256).max);
    }

    function test_Borrow_RevertsOnReentrantCall() public {
        vm.startPrank(attacker);
        market.supply(10e18);

        evilUsdg.armAttack();
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        market.borrow(800e18);
        vm.stopPrank();
    }

    function test_Borrow_SucceedsNormally_WhenAttackNotArmed() public {
        // Sanity: the malicious token's non-attacking path still behaves
        // like a normal token, so this isn't just proving a broken token reverts.
        vm.startPrank(attacker);
        market.supply(10e18);
        market.borrow(800e18);
        vm.stopPrank();

        (, uint256 debt) = market.getPosition(attacker);
        assertEq(debt, 800e18);
    }
}
