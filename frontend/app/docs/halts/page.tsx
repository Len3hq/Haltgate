import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, H3, P, UL, LI, Strong, Code, Callout, Table, DocLink } from "@/components/docs/prose";

export default function HaltsPage() {
  return (
    <DocsPageShell slug="halts">
      <H2>The five states</H2>
      <P>
        Every market sits in exactly one state at a time, held by its own <Code>HaltController</Code>. The state decides
        which actions the market will accept.
      </P>

      <Table
        head={["State", "Supply / Borrow", "Liquidate", "Repay", "Interest"]}
        rows={[
          ["OPEN", "Yes", "Yes", "Yes", "Accruing"],
          ["HALTING", "No", "No", "Yes", "Accruing"],
          ["HALTED", "No", "No", "Yes", "Frozen"],
          ["RESUMING", "No", "No", "Yes", "Accruing"],
          ["SETTLING", "No", "No", "Yes", "Frozen"],
        ]}
      />

      <P>
        Repayment is available in all five. That is deliberate and it is the single most important row in the table: a
        borrower must never be trapped in a position they are trying to get out of.
      </P>

      <H2>Why there are five and not two</H2>
      <P>
        A plain on/off switch would be enough to stop the damage, but not enough to reopen safely. The extra states
        exist to handle the edges of a halt rather than its middle.
      </P>

      <H3>HALTING</H3>
      <P>
        A corporate action is known to be coming. New borrowing and new supply stop before the price actually goes bad,
        rather than after. Nobody gets to open a fresh position into a window that is about to become unpriceable.
      </P>

      <H3>RESUMING</H3>
      <P>
        A fresh price has arrived, but liquidations do not reopen in the same instant. If they did, every position that
        drifted underwater during the freeze would be liquidatable at once, at a price borrowers had no opportunity to
        react to. RESUMING is a grace window: the price is live, repayment and top-ups work, and only then do
        liquidations come back.
      </P>

      <H3>SETTLING</H3>
      <P>
        The terminal case, covered in full on <DocLink href="/docs/settlement">Settlement</DocLink>. It exists so that a
        halt which never resolves cannot trap lender capital indefinitely.
      </P>

      <H2>How a halt is detected</H2>
      <P>
        The oracle exposes a pause flag. Anyone can call <Code>sync()</Code> on a market&apos;s halt controller, which
        reads that flag and moves the state accordingly. It is permissionless on purpose: the protocol should not depend
        on a privileged keeper noticing in time.
      </P>
      <P>
        Separately, every price-dependent function checks freshness directly against <Code>maxOracleStaleness</Code>,
        currently 24 hours. This matters because the halt controller only updates when somebody calls{" "}
        <Code>sync()</Code>, so it can still report OPEN while the underlying feed has gone stale. The independent check
        means a stale feed blocks borrowing even if nobody has synced yet.
      </P>

      <H2>How the corporate action itself is spotted</H2>
      <P>
        This is the honest soft spot, so it is worth stating plainly rather than glossing.{" "}
        <Strong>Today the event is spotted by a human.</Strong> Somebody calls <Code>pauseOracle()</Code> through the
        multisig, and from that point everything is trustless: anyone can call <Code>sync()</Code> to propagate it, so
        nobody can sit on a halt once the feed is paused.
      </P>
      <P>
        One layer is genuinely automatic regardless. The staleness check blocks borrowing on a feed that has stopped
        publishing whether or not anybody noticed or synced. Its limitation is precision rather than reliability: a
        stale feed cannot be distinguished from a weekend.
      </P>
      <P>
        The route to automating detection exists and is not hypothetical. CF Benchmarks publishes an xStocks corporate
        action feed with a two-stage <Strong>Pending</Strong> then <Strong>Effective</Strong> lifecycle, which maps onto
        HALTING and RESUMING almost exactly. It is an off-chain data product, so bringing it on-chain still needs a
        keeper: that moves the trust from a human watching the news to a keeper watching a regulated feed, which is
        better without being trustless.
      </P>

      <Callout kind="note" title="HaltGate is the response, not the detector">
        Detection and response are separate problems. Several vendors sell detection. What this protocol implements is
        what a lending market should actually <em>do</em> once a price cannot be trusted, which is the part that is
        deployed, tested and verifiable on-chain. The detector is a swappable input.
      </Callout>

      <P>
        Worth knowing: not every corporate action needs a halt at all. xStocks handles splits and dividends through a
        rebasing multiplier, so a two-for-one split doubles token balances while halving the price and passes through
        cleanly if a protocol reads both consistently. The window a halt actually protects is the narrower one where
        price and multiplier disagree.
      </P>

      <Callout kind="note" title="Two layers, on purpose">
        The state machine is the deliberate, observable signal. The staleness check is the backstop that does not depend
        on anyone doing anything. Either one is enough to stop a borrow.
      </Callout>

      <H2>What freezes, and why interest is one of them</H2>
      <P>
        Interest freezes in <Strong>HALTED</Strong> and <Strong>SETTLING</Strong> only, not in every non-OPEN state.
        The test is whether a trustworthy price exists. In those two there is none, so a borrower cannot judge their own
        position, cannot be liquidated, and would be accruing debt against something they are locked out of managing.
        The borrow index stops advancing and resumes from exactly where it left off.
      </P>
      <P>
        <Strong>HALTING and RESUMING keep accruing.</Strong> In both, the price is still usable: HALTING is a
        pre-warning before the feed goes, and by RESUMING a fresh price has already landed. A borrower can repay or top
        up in either, so the loan is genuinely live and charging for it is fair.
      </P>
      <P>
        The consequence for lenders is that yield pauses whenever interest does. That is the honest trade: the same
        event that protects borrowers from a bad liquidation also stops the meter for the people funding them.
      </P>

      <H2>What a halt does not do</H2>
      <UL>
        <LI>It does not seize anything. No position changes hands because of a halt.</LI>
        <LI>It does not cancel debt. Balances are exactly where they were when the halt began.</LI>
        <LI>
          It does not affect other markets. Each stock has its own controller, so halting NVIDIA leaves Tesla, Apple,
          Microsoft and the S&amp;P 500 market untouched.
        </LI>
        <LI>
          It does not block <Strong>repayment</Strong>, and it does not block{" "}
          <DocLink href="/docs/fixed-term">repaying a fixed-term loan</DocLink> either.
        </LI>
      </UL>
    </DocsPageShell>
  );
}
