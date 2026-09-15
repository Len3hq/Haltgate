// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockPausableOracle} from "../src/oracle/MockPausableOracle.sol";
import {MockWrappedXStock} from "../src/tokens/MockWrappedXStock.sol";
import {MockUSDG} from "../src/tokens/MockUSDG.sol";
import {HaltController} from "../src/core/HaltController.sol";
import {Market} from "../src/core/Market.sol";

/// @notice Deploys the full HaltGate stack. Defaults to mocks throughout
/// (per BUILD.md §3.3: no real xStocks contract, wrapped or raw, is
/// confirmed on X Layer testnet). Real testnet USDG is confirmed available
/// via faucet.paxos.com -- set USDG_ADDRESS once you have it to use it
/// directly instead of deploying MockUSDG.
contract Deploy is Script {
    uint256 constant INITIAL_PRICE = 180e18; // placeholder wNVDAx/USDG price -- confirm real price before any mainnet use
    uint256 constant MAX_LTV = 0.5e18;
    uint256 constant LIQ_THRESHOLD = 0.55e18;
    uint256 constant MARKET_SEED_LIQUIDITY = 100_000e18;
    uint256 constant DEMO_COLLATERAL_MINT = 100e18;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address usdgOverride = vm.envOr("USDG_ADDRESS", address(0));
        bool usingMockUsdg = usdgOverride == address(0);

        vm.startBroadcast(deployerKey);

        MockPausableOracle oracle = new MockPausableOracle(INITIAL_PRICE, deployer);
        MockWrappedXStock wNVDAx = new MockWrappedXStock(deployer);

        address usdg;
        if (usingMockUsdg) {
            MockUSDG mockUsdg = new MockUSDG(deployer);
            usdg = address(mockUsdg);
        } else {
            usdg = usdgOverride;
        }

        HaltController controller = new HaltController(address(oracle), deployer, deployer);
        Market market =
            new Market(address(wNVDAx), usdg, address(oracle), address(controller), deployer, MAX_LTV, LIQ_THRESHOLD);

        // Seeding market liquidity and demo collateral only works with mocks
        // -- can't mint real USDG, and only the deployer holds mock wNVDAx.
        if (usingMockUsdg) {
            MockUSDG(usdg).mint(deployer, MARKET_SEED_LIQUIDITY);
            MockUSDG(usdg).approve(address(market), MARKET_SEED_LIQUIDITY);
            market.fundMarket(MARKET_SEED_LIQUIDITY);
        }
        wNVDAx.mint(deployer, DEMO_COLLATERAL_MINT);

        vm.stopBroadcast();

        console2.log("Deployer:          ", deployer);
        console2.log("Oracle:            ", address(oracle));
        console2.log("wNVDAx (mock):     ", address(wNVDAx));
        console2.log("USDG:              ", usdg, usingMockUsdg ? "(mock -- swap in real testnet USDG via USDG_ADDRESS)" : "(real)");
        console2.log("HaltController:    ", address(controller));
        console2.log("Market:            ", address(market));
        if (usingMockUsdg) {
            console2.log("Market seeded with", MARKET_SEED_LIQUIDITY / 1e18, "mock USDG liquidity");
        } else {
            console2.log("NOTE: market NOT seeded -- fund it manually with real USDG via market.fundMarket()");
        }
    }
}
