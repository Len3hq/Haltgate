import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, H3, P, UL, LI, Strong, Code, Callout, Table, DocLink } from "@/components/docs/prose";

export default function RoadmapPage() {
  return (
    <DocsPageShell slug="roadmap">
      <P>
        HaltGate was built for a hackathon, and the scope was chosen deliberately: prove the whole mechanism on testnet,
        including markets that halt on their own around real corporate actions. This page separates what is running
        today from what comes next with funding. Nothing in the second half is claimed as built.
      </P>

      <H2>Built and running</H2>
      <Table
        head={["Piece", "Status"]}
        rows={[
          ["Five-state halt machine, gating, settlement", "Deployed on X Layer testnet, tested"],
          ["Variable, fixed-term and Multiply products", "Deployed on X Layer testnet"],
          ["Automatic halts from the real corporate-action schedule", "Running, keeper service on Railway"],
          ["Live prices into the oracles every 15 minutes", "Running, same keeper"],
          ["Independent sync() watchdog", "Running, separate service and key"],
        ]}
      />
      <P>
        How the automatic halts work is on <DocLink href="/docs/halts">How halts work</DocLink>. In short, a keeper reads
        each stock&apos;s real schedule from the issuer&apos;s own contract and drives the matching market through the
        halt, then reopens it only when the new multiplier, a fresh price and solvency all check out.
      </P>

      <H2>Next, with funding</H2>

      <H3>1. On-chain halt rules</H3>
      <P>
        Today the keeper decides when to halt and the contracts obey. The next step moves those rules into the contracts
        themselves, so that the keeper is only the most reliable caller, not a trusted one.
      </P>
      <UL>
        <LI>
          <Strong>The schedule read on-chain.</Strong> <Code>HaltController</Code> reads the raw xStock&apos;s{" "}
          <Code>newMultiplierActivationTime()</Code> directly. On mainnet the token is on the same chain, so there is no
          relay and no trusted party.
        </LI>
        <LI>
          <Strong>Permissionless halting.</Strong> <Code>sync()</Code>, which anyone can call, would also move a market
          to HALTING and HALTED from that schedule. Today it only reacts to an oracle pause.
        </LI>
        <LI>
          <Strong>Solvency enforced, not trusted.</Strong> Reopening would require <Code>isSystemSolvent()</Code> and a
          minimum time in RESUMING, on-chain. Today the keeper checks both before reopening, but the contract does not
          insist on it.
        </LI>
      </UL>
      <P>
        This is scheduled with the mainnet deployment rather than before it. Each market holds its halt controller as
        an immutable reference, so the change means redeploying every market, and doing that twice would be wasted work.
      </P>

      <H3>2. Licensed corporate-action data</H3>
      <P>
        CF Benchmarks publishes an xStocks Corporate Action Feed: an independent, versioned record whose{" "}
        <Strong>Pending</Strong> and <Strong>Effective</Strong> stages map onto HALTING and RESUMING. On mainnet it
        becomes the primary source, running alongside the issuer&apos;s on-chain schedule as a cross-check. If they
        disagree, the market halts and someone is alerted. The feed is commercially licensed, which is why it waits for
        funding.
      </P>

      <H3>3. Mainnet launch</H3>
      <UL>
        <LI>
          Chainlink Data Streams for prices. It is pull-based, so every price-dependent action carries a signed report.
          See <DocLink href="/docs/mainnet">Mainnet</DocLink>.
        </LI>
        <LI>Real xStock collateral, and routing through a DEX in place of the internal swap module.</LI>
        <LI>A multisig with real co-signers and a timelock measured in days, with keeper keys held in a KMS.</LI>
        <LI>Risk parameters re-derived from real volatility and liquidity data.</LI>
        <LI>A third-party audit of the contracts and of the keeper&apos;s permissions.</LI>
      </UL>

      <H3>4. Product</H3>
      <UL>
        <LI>
          Converting seized fixed-term collateral back to cash. It is left manual today on purpose, because an
          automatic sale has to read a price, which is the dependency that loan type exists to avoid. See{" "}
          <DocLink href="/docs/fixed-term">Fixed Term</DocLink>.
        </LI>
        <LI>Lending liquidity programmes, since pool depth on testnet is only what has been supplied.</LI>
      </UL>

      <Callout kind="note" title="Why this order">
        Each step removes a piece of trust that the testnet version still needs. Automation removed the human watching
        the news. On-chain rules remove the need to trust the keeper. Licensed data and an audit remove the need to
        trust a single source and our own review.
      </Callout>
    </DocsPageShell>
  );
}
