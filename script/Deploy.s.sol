// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {MockPausableOracle} from "../src/oracle/MockPausableOracle.sol";
import {MockWrappedXStock} from "../src/tokens/MockWrappedXStock.sol";
import {MockUSDG} from "../src/tokens/MockUSDG.sol";
import {HaltController} from "../src/core/HaltController.sol";
import {Market} from "../src/core/Market.sol";
import {LenderVault} from "../src/core/LenderVault.sol";
import {InterestRateModel} from "../src/core/InterestRateModel.sol";
import {Multisig} from "../src/governance/Multisig.sol";

/// @notice Deploys the full HaltGate stack, including governance.
///
/// wNVDAx is always a mock (per BUILD.md §3.3: no real xStocks contract,
/// wrapped or raw, is confirmed on X Layer testnet). USDG defaults to the
/// real, verified testnet contract on X Layer testnet (chain 1952) --
/// confirmed live on-chain, 6 decimals, at
/// 0xF0863D7A29a55d0c4263c11bFac754312ff078DF, from Paxos's own docs. On any
/// other chain, or if USDG_ADDRESS is explicitly set, that takes precedence;
/// otherwise falls back to a 6-decimal MockUSDG.
///
/// Governance is deliberately three-tiered, not "wrap everything in a
/// timelock":
///   1. HaltController.keeper -- fast, narrow. beginHalting()/completeResume()
///      have to react to real corporate-action timing; sync() is already
///      permissionless. Not behind the multisig or timelock at all.
///   2. Oracle.owner -- the multisig directly, no timelock. pauseOracle()/
///      resumeOracle()/setPrice() are time-sensitive (a real CA can't wait
///      through a multi-day delay), but must still require multi-party
///      agreement so no single compromised key can move prices.
///   3. Market.owner / HaltController.owner -- multisig behind a
///      TimelockController. Rare, high-impact changes (risk params, keeper
///      reassignment, emergency force-resume) get the full mandatory-delay
///      treatment. TimelockController's admin is disabled at construction
///      (address(0), confirmed against the installed OZ source this
///      requires no grant-then-renounce step) -- no bypass role exists
///      anywhere in the stack.
///
/// Confirmed directly against Safe's official chain config API that Safe
/// does not support X Layer, hence the self-built Multisig rather than a
/// dependency on unsupported infrastructure.
contract Deploy is Script {
    address constant XLAYER_TESTNET_USDG = 0xF0863D7A29a55d0c4263c11bFac754312ff078DF;
    uint256 constant XLAYER_TESTNET_CHAIN_ID = 1952;

    uint256 constant INITIAL_PRICE = 180e18; // placeholder wNVDAx/USDG price -- confirm real price before any mainnet use
    uint256 constant MAX_LTV = 0.5e18;
    uint256 constant LIQ_THRESHOLD = 0.55e18;
    uint256 constant RESERVE_FACTOR = 0.1e18; // 10% of interest kept as protocol reserves
    uint8 constant MOCK_USDG_DECIMALS = 6; // matches real USDG, confirmed on-chain
    uint256 constant MARKET_SEED_LIQUIDITY = 100_000 * 10 ** MOCK_USDG_DECIMALS;
    uint256 constant DEMO_COLLATERAL_MINT = 100e18;

    // Kinked-rate defaults (Compound/Aave-standard shape): 0% base, rising to
    // 8% APY at 80% utilization (the kink), then steeply to 68% APY at 100%
    // utilization -- pulls utilization back down hard once liquidity gets tight.
    uint256 constant IRM_BASE_RATE_PER_YEAR = 0;
    uint256 constant IRM_MULTIPLIER_PER_YEAR = 0.1e18;
    uint256 constant IRM_JUMP_MULTIPLIER_PER_YEAR = 3.0e18;
    uint256 constant IRM_KINK = 0.8e18;

    struct Deployment {
        address deployer;
        address keeper;
        address oracle;
        address wNVDAx;
        address usdg;
        bool usingMockUsdg;
        address controller;
        address lenderVault;
        address interestRateModel;
        address market;
        address multisig;
        address timelock;
        uint256 multisigThreshold;
        uint256 multisigSignerCount;
        uint256 timelockMinDelay;
    }

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        Deployment memory d = _deploy(deployerKey);
        vm.stopBroadcast();

        _logSummary(d);
    }

    function _deploy(uint256 deployerKey) internal returns (Deployment memory d) {
        d.deployer = vm.addr(deployerKey);
        d.keeper = vm.envOr("KEEPER_ADDRESS", d.deployer);

        address usdgOverride = _resolveUsdgAddress();
        d.usingMockUsdg = usdgOverride == address(0);

        MockPausableOracle oracle = new MockPausableOracle(INITIAL_PRICE, d.deployer);
        MockWrappedXStock wNVDAx = new MockWrappedXStock("Mock Wrapped NVIDIA xStock", "wNVDAx-MOCK", d.deployer);
        d.oracle = address(oracle);
        d.wNVDAx = address(wNVDAx);

        if (d.usingMockUsdg) {
            d.usdg = address(new MockUSDG(d.deployer, MOCK_USDG_DECIMALS));
        } else {
            d.usdg = usdgOverride;
        }

        HaltController controller = new HaltController(d.oracle, d.deployer, d.keeper);
        d.controller = address(controller);

        // LenderVault needs Market's address to read its pending-accrual view,
        // but Market's constructor needs LenderVault's address too -- deploy
        // the vault first with `market` left unset (one-time-settable), wire
        // Market to it, then close the loop with a single setMarket() call.
        LenderVault vault = new LenderVault(d.usdg, d.deployer);
        d.lenderVault = address(vault);

        InterestRateModel irm =
            new InterestRateModel(IRM_BASE_RATE_PER_YEAR, IRM_MULTIPLIER_PER_YEAR, IRM_JUMP_MULTIPLIER_PER_YEAR, IRM_KINK, d.deployer);
        d.interestRateModel = address(irm);

        Market market = new Market(
            d.wNVDAx,
            d.usdg,
            d.oracle,
            address(controller),
            d.lenderVault,
            d.interestRateModel,
            d.deployer,
            MAX_LTV,
            LIQ_THRESHOLD,
            RESERVE_FACTOR
        );
        d.market = address(market);
        vault.setMarket(d.market);

        // Seeding market liquidity only works with the mock -- can't mint real USDG.
        // The deployer becomes the vault's first LP, same as any other depositor.
        if (d.usingMockUsdg) {
            MockUSDG(d.usdg).mint(d.deployer, MARKET_SEED_LIQUIDITY);
            MockUSDG(d.usdg).approve(d.lenderVault, MARKET_SEED_LIQUIDITY);
            vault.deposit(MARKET_SEED_LIQUIDITY, d.deployer);
        }
        wNVDAx.mint(d.deployer, DEMO_COLLATERAL_MINT); // only the deployer holds mock wNVDAx either way

        _deployGovernanceAndTransfer(d, oracle, market, controller, vault, irm);
    }

    function _deployGovernanceAndTransfer(
        Deployment memory d,
        MockPausableOracle oracle,
        Market market,
        HaltController controller,
        LenderVault vault,
        InterestRateModel irm
    ) internal {
        address[] memory multisigSigners = _resolveMultisigSigners(d.deployer);
        d.multisigThreshold = vm.envOr("MULTISIG_THRESHOLD", uint256(1));
        d.multisigSignerCount = multisigSigners.length;
        // Demo-friendly default (10 min) so the delay can actually be shown
        // end-to-end in a live demo. Set TIMELOCK_MIN_DELAY much higher
        // (days) before anything resembling a real deployment.
        d.timelockMinDelay = vm.envOr("TIMELOCK_MIN_DELAY", uint256(10 minutes));

        Multisig multisig = new Multisig(multisigSigners, d.multisigThreshold);
        d.multisig = address(multisig);

        address[] memory proposers = new address[](1);
        proposers[0] = d.multisig;
        address[] memory executors = new address[](1);
        executors[0] = address(0); // open execution once ready, per design note above
        d.timelock = address(new TimelockController(d.timelockMinDelay, proposers, executors, address(0)));

        oracle.transferOwnership(d.multisig); // tier 2: fast, multi-party, no delay
        market.transferOwnership(d.timelock); // tier 3: multi-party + mandatory delay
        controller.transferOwnership(d.timelock); // tier 3: multi-party + mandatory delay
        vault.transferOwnership(d.timelock); // tier 3: multi-party + mandatory delay
        irm.transferOwnership(d.timelock); // tier 3: rate curve changes are a risk parameter like any other
        // keeper (tier 1) was already set at construction -- not an owner-transferable role.
    }

    function _logSummary(Deployment memory d) internal pure {
        console2.log("Deployer:          ", d.deployer);
        console2.log("Keeper (fast):     ", d.keeper);
        console2.log("Oracle:            ", d.oracle, "(owner: multisig, no delay)");
        console2.log("wNVDAx (mock):     ", d.wNVDAx);
        console2.log("USDG:              ", d.usdg, d.usingMockUsdg ? "(mock, 6 decimals)" : "(real)");
        console2.log("HaltController:    ", d.controller, "(owner: timelock)");
        console2.log("LenderVault:       ", d.lenderVault, "(owner: timelock)");
        console2.log("InterestRateModel: ", d.interestRateModel, "(owner: timelock)");
        console2.log("Market:            ", d.market, "(owner: timelock)");
        console2.log("Multisig:          ", d.multisig);
        console2.log("  threshold", d.multisigThreshold, "of", d.multisigSignerCount);
        console2.log("TimelockController:", d.timelock, "minDelay (s):", d.timelockMinDelay);
        if (d.usingMockUsdg) {
            console2.log("Vault seeded with", MARKET_SEED_LIQUIDITY / 10 ** MOCK_USDG_DECIMALS, "mock USDG liquidity (deployer is first LP)");
        } else {
            console2.log("NOTE: vault NOT seeded -- fund it manually with real USDG via vault.deposit()");
        }
        if (d.multisigSignerCount == 1) {
            console2.log("NOTE: multisig has a single signer (the deployer) -- add real co-signers via");
            console2.log("      MULTISIG_SIGNERS before this is genuinely multi-party.");
        }
    }

    /// @notice Reads MULTISIG_SIGNER_1, _2, ... (up to 10) as individually-
    /// indexed env vars, stopping at the first unset one. Kept as separate
    /// vars rather than a single comma-delimited MULTISIG_SIGNERS list: an
    /// early "odd number of digits" parse failure looked like a cheatcode
    /// bug in vm.envOr's array parsing, but turned out to be a malformed
    /// address hand-typed from memory (39 hex chars, not 40) -- confirmed
    /// by diffing it against the real address pulled from a live chain.
    /// The indexed form is kept anyway since it avoids comma-escaping
    /// entirely and each signer is individually named, not because the
    /// array parser was ever actually at fault. Falls back to just the
    /// deployer if none are set.
    function _resolveMultisigSigners(address deployer) internal view returns (address[] memory) {
        address[10] memory buf;
        uint256 count = 0;
        for (uint256 i = 1; i <= 10; i++) {
            address signer = vm.envOr(string.concat("MULTISIG_SIGNER_", vm.toString(i)), address(0));
            if (signer == address(0)) break;
            buf[count++] = signer;
        }
        if (count == 0) {
            address[] memory defaultSigners = new address[](1);
            defaultSigners[0] = deployer;
            return defaultSigners;
        }
        address[] memory signers = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            signers[i] = buf[i];
        }
        return signers;
    }

    /// @return The USDG address to use, or address(0) to signal "deploy a mock."
    function _resolveUsdgAddress() internal view returns (address) {
        address override_ = vm.envOr("USDG_ADDRESS", address(0));
        if (override_ != address(0)) return override_;
        if (block.chainid == XLAYER_TESTNET_CHAIN_ID) return XLAYER_TESTNET_USDG;
        return address(0);
    }
}
