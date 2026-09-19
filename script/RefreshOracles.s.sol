// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Multisig} from "../src/governance/Multisig.sol";
import {MockPausableOracle} from "../src/oracle/MockPausableOracle.sol";

/// @notice Re-pushes each mock oracle's current price so `updatedAt` moves
/// forward. The mocks have no upstream feed, so without this they age past
/// Market's 24h staleness window and borrowing stops across every market.
/// Real deployments get this from the feed itself; on testnet it's a cron job.
///
/// Run: forge script script/RefreshOracles.s.sol --rpc-url $RPC --broadcast --legacy
/// Env: ORACLE_ADDRESS, TSLA_ORACLE, AAPL_ORACLE, MSFT_ORACLE, SPY_ORACLE,
/// MULTISIG_ADDRESS, DEPLOYER_PRIVATE_KEY.
contract RefreshOracles is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        Multisig multisig = Multisig(payable(vm.envAddress("MULTISIG_ADDRESS")));

        address[] memory oracles = new address[](5);
        oracles[0] = vm.envAddress("ORACLE_ADDRESS");
        oracles[1] = vm.envAddress("TSLA_ORACLE");
        oracles[2] = vm.envAddress("AAPL_ORACLE");
        oracles[3] = vm.envAddress("MSFT_ORACLE");
        oracles[4] = vm.envAddress("SPY_ORACLE");

        vm.startBroadcast(pk);
        for (uint256 i = 0; i < oracles.length; i++) {
            (uint256 price,, bool paused) = MockPausableOracle(oracles[i]).latestPrice();
            // A paused oracle is a halt in progress -- refreshing it would
            // silently resolve the very condition the demo is showing.
            if (paused) {
                console2.log("skipped (paused)", oracles[i]);
                continue;
            }
            bytes memory data = abi.encodeCall(MockPausableOracle.setPrice, (price));
            uint256 txId = multisig.propose(oracles[i], 0, data);
            multisig.execute(txId);
            console2.log("refreshed", oracles[i], price);
        }
        vm.stopBroadcast();
    }
}
