import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, P, Strong, Code, Callout, Table, DocLink } from "@/components/docs/prose";

export default function MainnetDocsPage() {
  return (
    <DocsPageShell slug="mainnet">
      <Callout kind="warn" title="HaltGate is not deployed on X Layer mainnet">
        The app has a read-only Mainnet view, reachable from the network toggle in the header. It shows the real assets
        the protocol would lend against, queried live. Nothing there can be transacted with.
      </Callout>

      <H2>What is actually there</H2>
      <P>
        Eight tokenized stocks trade on X Layer with on-chain liquidity: NVIDIA, Tesla, Apple, Alphabet, MicroStrategy,
        Coinbase, the Nasdaq 100 ETF and the S&amp;P 500 ETF. Each is a non-rebasing wrapper over a raw token issued by
        Backed, paired against either USDG or USDC in a Uniswap pool.
      </P>
      <P>
        Those pools are the only on-chain price source. Their quotes land within 0.3% of real market prices, which is
        close enough to lend against, and the Mainnet view reads them live rather than restating a figure.
      </P>

      <Callout kind="note" title="Pool liquidity is not lending liquidity">
        A Uniswap pool exists so people can swap. Nobody can borrow what sits in one. Those pools would give a mainnet
        deployment its price feed, an exit for liquidators and the swap leg inside Multiply, but the capital to lend
        would still have to be supplied by depositors.
      </Callout>

      <H2>How halt detection would change</H2>
      <P>
        No production price feed exposes a pause flag, but the token itself carries the schedule. Every raw xStock
        exposes <Code>newMultiplierActivationTime()</Code>, which Backed sets hours before a corporate action takes
        effect, and <Code>multiplier()</Code>, which switches to the new value at that second. The testnet keeper already
        acts on exactly this signal, reading it from mainnet and relaying it. On mainnet the halt controller reads it
        directly, on the same chain.
      </P>

      <Table
        head={["State", "Ports across?", "Why"]}
        rows={[
          ["HALTING", "Yes", "The activation time is published in advance, usually four to nine hours ahead"],
          ["HALTED", "Yes", "A window around the activation time, trustless and issuer-published"],
          ["RESUMING", "Yes", "The multiplier has switched, so resume is time-based plus a solvency check"],
        ]}
      />

      <P>
        That makes halting permissionless: anyone calling <Code>sync()</Code> can move a market into a halt on time,
        and a keeper becomes only the most reliable caller. For accuracy and independence, a licensed CF Benchmarks
        corporate-action feed runs alongside it. Both are funded work, see the{" "}
        <DocLink href="/docs/roadmap">Roadmap</DocLink>.
      </P>

      <H2>What else would be required</H2>
      <P>
        A third-party audit, lending liquidity, and DEX routing to replace the internal{" "}
        <DocLink href="/docs/parameters">SwapModule</DocLink>. The state machine, gating rules, settlement and the
        leverage stack all port unchanged; the halt controller gains the on-chain schedule described above.
      </P>
      <P>
        <Strong>Deploying without an audit would not be made safe by leaving the pools empty.</Strong> Supplying and
        depositing are permissionless, so anyone could put real funds into unaudited code.
      </P>
    </DocsPageShell>
  );
}
