// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Market} from "../src/core/Market.sol";
import {HaltController} from "../src/core/HaltController.sol";
import {LenderVault} from "../src/core/LenderVault.sol";
import {SwapModule} from "../src/periphery/SwapModule.sol";
import {MockPausableOracle} from "../src/oracle/MockPausableOracle.sol";
import {MockWrappedXStock} from "../src/tokens/MockWrappedXStock.sol";
import {WNVDAxFaucet} from "../src/tokens/WNVDAxFaucet.sol";

/// @notice Deploys one additional isolated market onto an existing HaltGate
/// deployment, reusing the shared InterestRateModel, multisig and timelock.
/// Each market gets its own oracle and HaltController -- that separation is
/// what makes halting one stock leave the others trading.
///
/// Required env: MARKET_NAME, MARKET_SYMBOL, MARKET_PRICE (18dp),
/// USDG_ADDRESS, INTEREST_RATE_MODEL_ADDRESS, MULTISIG_ADDRESS, TIMELOCK_ADDRESS.
contract DeployMarket is Script {
    uint256 constant MAX_LTV = 0.5e18;
    uint256 constant LIQ_THRESHOLD = 0.55e18;
    uint256 constant RESERVE_FACTOR = 0.1e18;
    uint256 constant SWAP_FEE = 0.003e18;
    uint256 constant FAUCET_SUPPLY = 1_000e18;
    uint256 constant SWAP_INVENTORY = 200e18;

    struct Deployed {
        MockWrappedXStock collateral;
        MockPausableOracle oracle;
        HaltController halt;
        LenderVault vault;
        Market market;
        SwapModule swap;
        WNVDAxFaucet faucet;
    }

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        Deployed memory d;

        vm.startBroadcast(pk);
        d = _deploy(vm.addr(pk));
        _wire(d);
        vm.stopBroadcast();

        console2.log("collateral    ", address(d.collateral));
        console2.log("faucet        ", address(d.faucet));
        console2.log("oracle        ", address(d.oracle));
        console2.log("haltController", address(d.halt));
        console2.log("lenderVault   ", address(d.vault));
        console2.log("market        ", address(d.market));
        console2.log("swapModule    ", address(d.swap));
    }

    function _deploy(address deployer) internal returns (Deployed memory d) {
        d.collateral = new MockWrappedXStock(vm.envString("MARKET_NAME"), vm.envString("MARKET_SYMBOL"), deployer);
        d.oracle = new MockPausableOracle(vm.envUint("MARKET_PRICE"), deployer);
        d.halt = new HaltController(address(d.oracle), deployer, deployer);
        d.vault = new LenderVault(vm.envAddress("USDG_ADDRESS"), deployer);
        d.market = new Market(
            address(d.collateral),
            vm.envAddress("USDG_ADDRESS"),
            address(d.oracle),
            address(d.halt),
            address(d.vault),
            vm.envAddress("INTEREST_RATE_MODEL_ADDRESS"),
            deployer,
            MAX_LTV,
            LIQ_THRESHOLD,
            RESERVE_FACTOR
        );
        d.swap = new SwapModule(
            address(d.collateral),
            vm.envAddress("USDG_ADDRESS"),
            address(d.oracle),
            address(d.halt),
            SWAP_FEE,
            vm.envAddress("MULTISIG_ADDRESS")
        );
        d.faucet = new WNVDAxFaucet(address(d.collateral));
    }

    function _wire(Deployed memory d) internal {
        d.vault.setMarket(address(d.market));

        // Stock the faucet and the swap's sell-side inventory before handing
        // governance over -- minting stays with the deployer since it's a mock.
        d.collateral.mint(address(d.faucet), FAUCET_SUPPLY);
        d.collateral.mint(address(d.swap), SWAP_INVENTORY);

        // Same governance split as the first market: multisig owns the fast
        // levers (oracle pause, swap fee), timelock owns everything else.
        d.market.setFixedParams(vm.envUint("FIXED_LTV"), vm.envUint("FIXED_RATE"));
        d.market.setSettlementBounty(vm.envUint("SETTLEMENT_BOUNTY"));

        d.oracle.transferOwnership(vm.envAddress("MULTISIG_ADDRESS"));
        d.halt.transferOwnership(vm.envAddress("TIMELOCK_ADDRESS"));
        d.vault.transferOwnership(vm.envAddress("TIMELOCK_ADDRESS"));
        d.market.transferOwnership(vm.envAddress("TIMELOCK_ADDRESS"));
    }
}
