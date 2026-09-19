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
          ["HALTING", "No", "No", "Yes", "Frozen"],
          ["HALTED", "No", "No", "Yes", "Frozen"],
          ["RESUMING", "No", "No", "Yes", "Frozen"],
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

      <Callout kind="note" title="Two layers, on purpose">
        The state machine is the deliberate, observable signal. The staleness check is the backstop that does not depend
        on anyone doing anything. Either one is enough to stop a borrow.
      </Callout>

      <H2>What freezes, and why interest is one of them</H2>
      <P>
        Freezing interest during a halt is not a courtesy. During a halt a borrower cannot add collateral by borrowing
        elsewhere in the protocol, cannot adjust their position, and cannot be liquidated. Charging them for that window
        would accrue debt against a position they are locked out of managing. So the borrow index stops advancing, and
        resumes from exactly where it left off.
      </P>
      <P>
        The consequence for lenders is that yield pauses too. That is the honest trade: the same event that protects
        borrowers from a bad liquidation also stops the meter for the people funding them.
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
