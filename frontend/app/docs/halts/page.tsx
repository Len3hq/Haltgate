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
        <Strong>Automatically, from the issuer&apos;s own schedule.</Strong> Backed, the issuer of xStocks, records every
        upcoming corporate action on the token contract before it happens: <Code>newMultiplierActivationTime()</Code>{" "}
        says when the new share multiplier takes effect, and <Code>multiplier()</Code> switches to it at that second.
        A keeper service reads that schedule for every stock, cross-checks it against the xStocks API, and drives the
        matching market through the halt on time. Nobody has to be watching the news.
      </P>

      <Table
        head={["When", "What the keeper does", "Market"]}
        rows={[
          ["2 hours before", "beginHalting()", "HALTING"],
          ["15 minutes before", "Pauses the oracle, then sync()", "HALTED"],
          ["The activation", "Nothing: the multiplier changes on its own", "HALTED"],
          ["15 minutes after, once the new multiplier is in place", "Resumes the oracle at a fresh price, then sync()", "RESUMING"],
          ["30 minutes later, if solvent and the price is fresh", "completeResume()", "OPEN"],
        ]}
      />

      <P>
        How much warning is there? Measured across every action the issuer has scheduled this way, usually{" "}
        <Strong>four to nine hours</Strong>. Once it was only nine minutes, so a keeper that first sees an action inside
        the final window skips straight to HALTED rather than missing it.
      </P>

      <H3>What the keeper will and won&apos;t do</H3>
      <UL>
        <LI>
          <Strong>It only reopens halts it started.</Strong> A halt it can&apos;t match to a scheduled action is reported
          and left alone.
        </LI>
        <LI>
          <Strong>It never reopens on a guess.</Strong> It needs the new multiplier in place, a price published after the
          action, the cooldown, and <Code>isSystemSolvent()</Code>. If solvency fails, the market stays in RESUMING.
        </LI>
        <LI>
          <Strong>It never touches SETTLING</Strong>, and a data source going quiet is never read as &quot;the action
          was cancelled&quot;.
        </LI>
        <LI>
          <Strong>It isn&apos;t the only safety net.</Strong> A separate watchdog, with its own key, calls{" "}
          <Code>sync()</Code> on any market that has drifted from its oracle. And the staleness check below blocks
          borrowing on a dead feed whether or not anybody acts at all.
        </LI>
      </UL>

      <P>
        Once the oracle is paused, everything is trustless: anyone can call <Code>sync()</Code>, so nobody can sit on a
        halt. What still requires trust is the keeper deciding <em>when</em> to pause. On testnet that is unavoidable,
        because the real schedule lives on X Layer mainnet and a testnet contract can&apos;t read it. The{" "}
        <DocLink href="/docs/roadmap">roadmap</DocLink> removes it on mainnet: there the halt controller reads the
        schedule itself, so any caller can halt a market on time, with CF Benchmarks&apos; licensed corporate-action
        feed as an independent second source.
      </P>

      <P>
        One layer is automatic regardless. The staleness check blocks borrowing on a feed that has stopped publishing,
        whether or not anybody noticed or synced. Its limitation is precision rather than reliability: a stale feed
        cannot be distinguished from a weekend.
      </P>

      <Callout kind="note" title="HaltGate is the response, not the detector">
        Detection and response are separate problems. What this protocol implements on-chain is what a lending market
        should actually <em>do</em> once a price cannot be trusted. The detector is a swappable input: today the
        issuer&apos;s on-chain schedule relayed by a keeper, on mainnet the same schedule read directly, alongside a
        licensed feed.
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
