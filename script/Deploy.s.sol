// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockPausableOracle} from "../src/oracle/MockPausableOracle.sol";
import {MockWrappedXStock} from "../src/tokens/MockWrappedXStock.sol";
import {MockUSDG} from "../src/tokens/MockUSDG.sol";
import {HaltController} from "../src/core/HaltController.sol";
import {Market} from "../src/core/Market.sol";

/// @notice Deploys the full HaltGate stack. wNVDAx is always a mock (per
/// BUILD.md §3.3: no real xStocks contract, wrapped or raw, is confirmed on
/// X Layer testnet). USDG defaults to the real, verified testnet contract on
/// X Layer testnet (chain 1952) -- confirmed live on-chain, 6 decimals, at
/// 0xF0863D7A29a55d0c4263c11bFac754312ff078DF, from Paxos's own docs.
/// On any other chain, or if USDG_ADDRESS is explicitly set, that takes
/// precedence; otherwise falls back to a 6-decimal MockUSDG.
contract Deploy is Script {
    address constant XLAYER_TESTNET_USDG = 0xF0863D7A29a55d0c4263c11bFac754312ff078DF;
    uint256 constant XLAYER_TESTNET_CHAIN_ID = 1952;

    uint256 constant INITIAL_PRICE = 180e18; // placeholder wNVDAx/USDG price -- confirm real price before any mainnet use
    uint256 constant MAX_LTV = 0.5e18;
    uint256 constant LIQ_THRESHOLD = 0.55e18;
    uint8 constant MOCK_USDG_DECIMALS = 6; // matches real USDG, confirmed on-chain
    uint256 constant MARKET_SEED_LIQUIDITY = 100_000 * 10 ** MOCK_USDG_DECIMALS;
    uint256 constant DEMO_COLLATERAL_MINT = 100e18;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address usdg = _resolveUsdgAddress();
        bool usingMockUsdg = usdg == address(0);

        vm.startBroadcast(deployerKey);

        MockPausableOracle oracle = new MockPausableOracle(INITIAL_PRICE, deployer);
        MockWrappedXStock wNVDAx = new MockWrappedXStock(deployer);

        if (usingMockUsdg) {
            MockUSDG mockUsdg = new MockUSDG(deployer, MOCK_USDG_DECIMALS);
            usdg = address(mockUsdg);
        }

        HaltController controller = new HaltController(address(oracle), deployer, deployer);
        Market market =
            new Market(address(wNVDAx), usdg, address(oracle), address(controller), deployer, MAX_LTV, LIQ_THRESHOLD);

        // Seeding market liquidity only works with the mock -- can't mint real USDG.
        if (usingMockUsdg) {
            MockUSDG(usdg).mint(deployer, MARKET_SEED_LIQUIDITY);
            MockUSDG(usdg).approve(address(market), MARKET_SEED_LIQUIDITY);
            market.fundMarket(MARKET_SEED_LIQUIDITY);
        }
        wNVDAx.mint(deployer, DEMO_COLLATERAL_MINT); // only the deployer holds mock wNVDAx either way

        vm.stopBroadcast();

        console2.log("Deployer:          ", deployer);
        console2.log("Oracle:            ", address(oracle));
        console2.log("wNVDAx (mock):     ", address(wNVDAx));
        console2.log("USDG:              ", usdg, usingMockUsdg ? "(mock, 6 decimals)" : "(real)");
        console2.log("HaltController:    ", address(controller));
        console2.log("Market:            ", address(market));
        if (usingMockUsdg) {
            console2.log("Market seeded with", MARKET_SEED_LIQUIDITY / 10 ** MOCK_USDG_DECIMALS, "mock USDG liquidity");
        } else {
            console2.log("NOTE: market NOT seeded -- fund it manually with real USDG via market.fundMarket()");
        }
    }

    /// @return The USDG address to use, or address(0) to signal "deploy a mock."
    function _resolveUsdgAddress() internal view returns (address) {
        address override_ = vm.envOr("USDG_ADDRESS", address(0));
        if (override_ != address(0)) return override_;
        if (block.chainid == XLAYER_TESTNET_CHAIN_ID) return XLAYER_TESTNET_USDG;
        return address(0);
    }
}
