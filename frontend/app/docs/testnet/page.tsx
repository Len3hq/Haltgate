import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, P, UL, LI, Strong, Code, Callout, Table, DocLink } from "@/components/docs/prose";

export default function TestnetPage() {
  return (
    <DocsPageShell slug="testnet">
      <H2>Network</H2>
      <Table
        head={["Field", "Value"]}
        rows={[
          ["Network", "X Layer testnet"],
          ["Chain ID", <Code key="c">1952</Code>],
          ["RPC", <Code key="r">https://testrpc.xlayer.tech/terigon</Code>],
          ["Explorer", <DocLink key="e" href="https://www.oklink.com/x-layer-testnet">OKLink</DocLink>],
          ["Gas token", "Testnet OKB"],
        ]}
      />

      <H2>Getting started in three steps</H2>
      <P>
        <Strong>1. Get gas.</Strong> You need a small amount of testnet OKB to send any transaction. Claim it from the{" "}
        <DocLink href="https://web3.okx.com/xlayer/faucet">X Layer faucet</DocLink>.
      </P>
      <P>
        <Strong>2. Get collateral.</Strong> Each market has its own permissionless faucet for its mock stock token, one
        claim per address. Open any market and find it under Testnet Tools in the sidebar.
      </P>
      <P>
        <Strong>3. Get USDG, if you want to lend.</Strong> USDG is a real testnet token and cannot be minted by this
        protocol. Claim it from the <DocLink href="https://faucet.paxos.com/">Paxos faucet</DocLink>. You do not need
        USDG to borrow, only to supply it as a lender or to repay a loan with interest.
      </P>

      <Callout kind="warn" title="Borrow depth is shallow">
        The lending pools hold only what has actually been supplied to them. If a borrow fails with an insufficient
        liquidity error, the pool is empty rather than broken. Supplying USDG through Earn deepens it for everyone.
      </Callout>

      <H2>What is real and what is mocked</H2>
      <P>This project has been deliberate about not overstating what is real.</P>

      <Table
        head={["Component", "Status"]}
        rows={[
          ["USDG", "Real testnet USDG, 6 decimals, not 18"],
          ["Collateral tokens", "Mocks, replicating the confirmed wrapped-xStock design"],
          ["Oracle", "Mock contract, fed real equity prices by a keeper"],
          ["SwapModule", "Stands in for a DEX, priced off the oracle"],
          ["Multisig and timelock", "Real contracts, testnet parameters"],
          ["Audit", "None"],
        ]}
      />

      <H2>Why the collateral is a mock</H2>
      <P>
        No xStock, raw or wrapped, is confirmed to exist on X Layer <Strong>testnet</Strong>. Real wNVDAx liquidity does
        exist on X Layer <Strong>mainnet</Strong>. Rather than pretend otherwise, the mock replicates the confirmed
        wrapped-xStock design: non-rebasing, with value accruing through an exchange rate.
      </P>

      <H2>Why the oracle is a mock</H2>
      <P>
        Real equity pricing on X Layer mainnet ships as Chainlink Data Streams, which is pull-based: there is no contract
        holding a current price to read. Separately, no production feed exposes a pause flag. A corporate-action pause is
        inferred from the feed going stale, and staleness alone cannot distinguish a corporate action from a weekend.
      </P>
      <P>
        So the mock reproduces the pause mechanism faithfully rather than assuming a feed that does not exist. Closing
        that gap on mainnet needs a corporate-action feed or a market-hours calendar, not just a different address.
      </P>

      <H2>Real prices, through a mock oracle</H2>
      <P>
        The oracle <Strong>contract</Strong> is a mock, but the prices in it are real. A keeper fetches live equity
        quotes and pushes them in, so the number shown on a market tracks the reference chart beside it rather than
        sitting at a made-up constant.
      </P>
      <P>
        This is worth stating precisely: it is a single-key push feed, not a decentralised oracle network. The data is
        real, the trust model is not. No third-party oracle was available to use instead. Pyth does not deploy on X
        Layer at all, and Chainlink&apos;s equity coverage there is mainnet-only and pull-based, meaning there is no
        contract holding a current price to read.
      </P>

      <Callout kind="note" title="A keeper cannot interfere with a halt">
        <Code>setPrice()</Code> reverts while the oracle is paused, so no amount of price pushing can overwrite or lift
        a halt. Only the multisig moves that state. The keeper also skips paused feeds outright, so a market being
        halted stays visibly frozen while the reference chart keeps moving.
      </Callout>

      <P>
        Large moves are <Strong>stepped, not forced</Strong>. A single update is capped at 20% deviation to reject
        suspicious jumps, and rather than loosening that guard the keeper pushes the largest allowed step and converges
        over successive runs. The guard stays at 20% throughout.
      </P>
      <P>
        Outside market hours the quote is simply the last close. Pushing it anyway keeps the timestamp fresh without
        inventing movement that did not happen, which matters because the mocks otherwise age past the 24-hour staleness
        window and borrowing stops across every market. If borrowing is failing everywhere at once, a stale feed is
        almost certainly why.
      </P>

      <H2>Governance is configured for convenience</H2>
      <UL>
        <LI>The multisig is 1-of-1.</LI>
        <LI>The timelock delay is 10 minutes.</LI>
        <LI>
          Neither is a meaningful security boundary as deployed. Both are real contracts, wired correctly, parameterised
          for a demo. See <DocLink href="/docs/governance">Governance</DocLink>.
        </LI>
      </UL>

      <Callout kind="danger" title="Not audited">
        Foundry tests and static analysis are engineering hygiene, not a substitute for third-party review. Do not treat
        anything here as production-ready.
      </Callout>
    </DocsPageShell>
  );
}
