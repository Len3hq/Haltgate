import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, P, UL, LI, Strong, Code, Callout, Table, DocLink } from "@/components/docs/prose";

export default function SettlementPage() {
  return (
    <DocsPageShell slug="settlement">
      <H2>The problem settlement solves</H2>
      <P>
        Freezing lender redemptions during a halt is what stops a bank run. But a freeze with no time limit is worse than
        the problem it solves: if an oracle never resumes, or a keeper never completes the transition, the mechanism
        built to protect lenders becomes the thing that strands their capital forever.
      </P>
      <P>
        &quot;What happens if the halt never ends?&quot; needed a real answer rather than a promise that it would.
      </P>

      <H2>A clock that governance cannot stop</H2>
      <P>
        A timer starts the moment a market leaves OPEN. It deliberately does <Strong>not</Strong> restart across HALTING,
        HALTED and RESUMING, because it measures how long capital has been restricted, not how long any single phase
        lasted. Restarting per phase would let a market cycle between them forever and never become settleable, which is
        precisely the failure being ruled out. It clears on return to OPEN.
      </P>
      <P>
        Once the clock passes the settlement delay, <Strong>anyone</Strong> can call <Code>forceSettle()</Code> and move
        the market into SETTLING. It is permissionless because a guarantee that depends on the same governance that let
        the market get stuck is not a guarantee.
      </P>

      <Table
        head={["Parameter", "Value"]}
        rows={[
          ["Settlement delay", "7 days"],
          ["Governance may set it between", "1 and 30 days"],
          ["Who can trigger settlement", "Anyone, once the delay has passed"],
        ]}
      />

      <Callout kind="note" title="Bounded, not removable">
        The floor stops governance setting the delay near zero and letting anyone stall an ordinary halt. The ceiling
        stops governance quietly restoring the indefinite lockup. The escape hatch can be retuned but never revoked.
      </Callout>

      <H2>Redemptions reopen pro-rata</H2>
      <P>
        Simply switching withdrawals back on after a timeout would hand back exactly the bank run the freeze prevented:
        early movers would drain the available cash at a stale share price while everyone slower absorbed the bad debt.
      </P>
      <P>
        Instead each holder is capped at their proportional slice of the cash on hand. Because everyone redeems at the
        same price and draws exactly their own proportion, cash and shares fall in step and the share price is left
        arithmetically unchanged.
      </P>

      <Callout kind="note" title="Why order stops mattering">
        Moving first earns you no better rate, only earlier access to a slice that was already yours. That is what stops
        settlement from reintroducing the run it was designed to prevent.
      </Callout>

      <H2>What settlement does not do</H2>
      <UL>
        <LI>It does not cancel anyone&apos;s debt.</LI>
        <LI>It does not reopen borrowing, liquidation or leverage. Those stay closed.</LI>
        <LI>It does not unfreeze interest.</LI>
        <LI>
          It does not force a sale of collateral. Nothing is liquidated during settlement, because the price that would
          be needed to do it fairly is still missing.
        </LI>
        <LI>It does not block repayment, which was never blocked in the first place.</LI>
      </UL>

      <H2>Returning to normal</H2>
      <P>
        Settlement is not necessarily terminal. If the oracle resumes and a fresh price arrives, the market can complete
        its transition back to OPEN and ordinary operation continues. What settlement guarantees is that lenders are not
        waiting on that happening.
      </P>
      <P>
        One direction is deliberately closed off: <Code>sync()</Code> refuses to drag a market that has reached SETTLING
        back into HALTED. Once the escape hatch has opened, a change in oracle state cannot close it again.
      </P>

      <H2>Fixed-term loans during settlement</H2>
      <P>
        Settling a matured <DocLink href="/docs/fixed-term">fixed-term loan</DocLink> is gated on liquidations being
        available, so it is unavailable throughout a halt and throughout settlement. Borrowers cannot lose collateral in
        a window where the price cannot be verified, and they can still repay the whole time.
      </P>

      <Callout kind="warn" title="Not demonstrated live">
        The post-deadline transition itself has not been exercised on-chain, because the floor on the delay is one day
        and a live chain cannot be time-warped. That path is covered by the contract test suite rather than by a
        demonstration. Verifying it live would mean either waiting out a real halt or lowering the floor for testnet,
        which would weaken the safety property.
      </Callout>
    </DocsPageShell>
  );
}
