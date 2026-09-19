import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, H3, P, Strong, Code, Callout, Table, DocLink, Addr } from "@/components/docs/prose";
import { MARKETS, SHARED } from "@/lib/contracts";

const EXPLORER = "https://www.oklink.com/x-layer-testnet/address/";

function Row({ label, address }: { label: string; address: string }) {
  return [
    label,
    <a key={address} href={`${EXPLORER}${address}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
      <Addr>{address}</Addr>
    </a>,
  ];
}

export default function ContractsPage() {
  return (
    <DocsPageShell slug="contracts">
      <Callout kind="note" title="Addresses come from the app's own registry">
        This page reads the same configuration the interface uses, so it cannot drift out of sync with what is actually
        deployed.
      </Callout>

      <H2>What each contract does</H2>
      <Table
        head={["Contract", "Role"]}
        rows={[
          ["HaltController", "The five-state machine. Reads the oracle's pause flag and gates everything else."],
          ["Market", "Collateral, debt, LTV, liquidations, interest and fixed-term loans. Never holds lender cash."],
          ["LenderVault", "ERC-4626 vault holding the USDG. Halt-gated, settlement-aware redemptions."],
          ["InterestRateModel", "Kinked utilization curve. Stateless, so every market shares one."],
          ["SwapModule", "Oracle-priced swap standing in for a DEX. Halt-gated."],
          ["LeverageZap", "Stateless leverage and multiply. Takes the market as a parameter."],
          ["Multisig", "Propose, confirm, execute. Threshold-based."],
          ["Timelock", "OpenZeppelin TimelockController. Owns the risk-bearing contracts."],
          ["Faucet", "Permissionless collateral faucet, one claim per address."],
        ]}
      />

      <H2>Shared across all markets</H2>
      <Table
        head={["Contract", "Address"]}
        rows={[
          Row({ label: "USDG (real testnet)", address: SHARED.usdg }),
          Row({ label: "InterestRateModel", address: SHARED.interestRateModel }),
          Row({ label: "LeverageZap", address: SHARED.leverageZap }),
          Row({ label: "Multisig", address: SHARED.multisig }),
          Row({ label: "Timelock", address: SHARED.timelock }),
        ]}
      />

      <H2>Markets</H2>
      <P>
        Each market is a fully isolated stack with its own collateral token, faucet, oracle, halt controller, vault,
        market and swap module. That isolation is the point: halting one leaves the other four trading.
      </P>

      {MARKETS.map((m) => (
        <div key={m.key}>
          <H3>{`${m.name} (${m.symbol})`}</H3>
          <Table
            head={["Contract", "Address"]}
            rows={[
              Row({ label: "Market", address: m.market }),
              Row({ label: "LenderVault", address: m.lenderVault }),
              Row({ label: "HaltController", address: m.haltController }),
              Row({ label: "Oracle (mock)", address: m.oracle }),
              Row({ label: "SwapModule", address: m.swapModule }),
              Row({ label: "Collateral token", address: m.collateral }),
              Row({ label: "Faucet", address: m.faucet }),
            ]}
          />
        </div>
      ))}

      <H2>Ownership</H2>
      <Table
        head={["Contract", "Owner"]}
        rows={[
          ["Market", "Timelock"],
          ["LenderVault", "Timelock"],
          ["HaltController", "Timelock"],
          ["InterestRateModel", "Timelock"],
          ["Oracle", "Multisig"],
          ["SwapModule", "Multisig"],
          ["LeverageZap", "No owner, stateless"],
          ["Faucet", "No owner, permissionless"],
        ]}
      />
      <P>
        See <DocLink href="/docs/governance">Governance</DocLink> for why the split runs this way.
      </P>

      <H2>Verifying for yourself</H2>
      <P>
        Every address above links to <DocLink href="https://www.oklink.com/x-layer-testnet">OKLink</DocLink>. The
        parameters on <DocLink href="/docs/parameters">Risk parameters</DocLink> are all public getters, so{" "}
        <Code>maxLTV()</Code>, <Code>fixedMaxLTV()</Code>, <Code>settlementBounty()</Code> and the rest can be read
        directly rather than taken on trust.
      </P>

      <Callout kind="warn" title="Addresses change on core upgrades">
        The contracts are not proxied. A change to <Strong>Market</Strong> or <Strong>LenderVault</Strong> logic means a
        new address for both, since each holds an immutable reference to the other. Check here rather than relying on a
        copy made earlier.
      </Callout>
    </DocsPageShell>
  );
}
