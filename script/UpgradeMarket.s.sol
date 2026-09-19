// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Market} from "../src/core/Market.sol";
import {LenderVault} from "../src/core/LenderVault.sol";

/// @notice Redeploys the Market + LenderVault pair for an existing market,
/// reusing its oracle, HaltController, collateral and SwapModule. Needed
/// whenever Market's logic changes, since LenderVault's market reference is
/// one-time-set and Market's vault reference is immutable.
///
/// Env: EXISTING_MARKET, INTEREST_RATE_MODEL_ADDRESS, TIMELOCK_ADDRESS,
/// FIXED_LTV, FIXED_RATE, SETTLEMENT_BOUNTY.
contract UpgradeMarket is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        Market old = Market(vm.envAddress("EXISTING_MARKET"));

        vm.startBroadcast(pk);

        LenderVault vault = new LenderVault(address(old.debtToken()), deployer);
        Market market = new Market(
            address(old.collateralToken()),
            address(old.debtToken()),
            address(old.oracle()),
            address(old.haltController()),
            address(vault),
            vm.envAddress("INTEREST_RATE_MODEL_ADDRESS"),
            deployer,
            old.maxLTV(),
            old.liquidationThreshold(),
            old.reserveFactor()
        );
        vault.setMarket(address(market));
        market.setFixedParams(vm.envUint("FIXED_LTV"), vm.envUint("FIXED_RATE"));
        market.setSettlementBounty(vm.envUint("SETTLEMENT_BOUNTY"));

        vault.transferOwnership(vm.envAddress("TIMELOCK_ADDRESS"));
        market.transferOwnership(vm.envAddress("TIMELOCK_ADDRESS"));

        vm.stopBroadcast();

        console2.log("lenderVault   ", address(vault));
        console2.log("market        ", address(market));
    }
}
