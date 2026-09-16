import { defineConfig } from "@wagmi/cli";
import { foundry, react } from "@wagmi/cli/plugins";

// Generates typed React hooks directly from the Foundry build artifacts in
// ../out -- so the UI can't silently drift from what's actually deployed.
// Excludes mocks and test-only contracts; the UI only needs the real
// production-path contracts.
export default defineConfig({
  out: "lib/generated.ts",
  plugins: [
    foundry({
      project: "..",
      include: [
        "Market.sol/**",
        "HaltController.sol/**",
        "LenderVault.sol/**",
        "InterestRateModel.sol/**",
        "IPausableOracle.sol/**",
        "MockWrappedXStock.sol/**",
        "MockUSDG.sol/**",
      ],
      forge: {
        build: false, // build separately via `forge build` -- avoid re-running it on every codegen
      },
    }),
    react(),
  ],
});
