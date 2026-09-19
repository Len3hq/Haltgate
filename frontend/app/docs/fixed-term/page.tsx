import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, P, UL, LI, Strong, Code, Callout, Table, DocLink } from "@/components/docs/prose";

export default function FixedTermPage() {
  return (
    <DocsPageShell slug="fixed-term">
      <Callout kind="note" title="No liquidation. Ever.">
        A fixed-term position cannot be closed out on price at any point during its term, however far the stock falls.
        Maturity replaces liquidation as the only thing that resolves the loan.
      </Callout>

      <H2>How it works</H2>
      <P>
        You lock collateral, pick a term, and borrow. The total you will owe at the end is quoted once, at origination,
        and never changes again. There is no utilization curve, no rate spike and no surprise at the end. Between opening
        and maturity, nothing can touch your position.
      </P>
      <P>
        It resolves one of two ways: you repay the quoted amount in full and your collateral unlocks, or the term ends
        unpaid and the collateral is claimed.
      </P>

      <H2>Terms and rate</H2>
      <Table
        head={["Field", "Value"]}
        rows={[
          ["Rate", "8%/yr, simple interest"],
          ["Terms offered", "1, 7, 14 or 30 days"],
          ["Contract bounds", "1 to 30 days"],
          ["Loans per address", "One at a time, per market"],
        ]}
      />
      <P>
        Interest is simple, not compounded, and computed once: <Code>principal + principal × rate × term / 1 year</Code>.
        That figure is stored with the loan and is the exact amount you repay.
      </P>

      <H2>Borrowing limit</H2>
      <P>
        The fixed-term limit is lower than the variable one on every market, and always will be, enforced on-chain in
        both directions.
      </P>
      <Table
        head={["Market", "Fixed-term max LTV", "Variable max LTV"]}
        rows={[
          ["Tesla", "30%", "45%"],
          ["NVIDIA", "35%", "50%"],
          ["Apple", "40%", "55%"],
          ["Microsoft", "40%", "55%"],
          ["S&P 500 ETF", "45%", "60%"],
        ]}
      />

      <H2>Why you can borrow less here</H2>
      <P>
        There are two reasons, and the structural one is the stronger.
      </P>
      <UL>
        <LI>
          <Strong>Losses land on a shared pool.</Strong> In a peer-to-peer market, the lender who offers a high LTV is
          risking their own capital and chose that number themselves. Here a default is absorbed by every depositor, none
          of whom picked the limit. So the cap belongs to governance and has to be conservative.
        </LI>
        <LI>
          <Strong>Nothing closes the position early.</Strong> A liquidatable loan gets trimmed at the first sign of
          trouble. A fixed-term loan has to survive the entire term untouched, so the opening cushion is the only
          protection it ever gets.
        </LI>
      </UL>

      <H2>Repaying</H2>
      <P>
        Repay the full quoted amount and the collateral is released in the same transaction. Partial repayment is not
        supported: the loan is a single fixed obligation rather than a running balance.
      </P>
      <P>
        Repayment works <Strong>during a halt</Strong>, on the same principle as the variable market. It only ever
        reduces risk.
      </P>

      <H2>What happens at maturity if you do not repay</H2>
      <P>
        Nothing happens automatically. The loan simply becomes claimable, and then it is a race you can still win.
      </P>
      <UL>
        <LI>
          <Strong>You can still repay.</Strong> There is no late fee and the amount owed does not grow after the end
          date. As long as nobody has claimed the loan, repaying works exactly as before.
        </LI>
        <LI>
          <Strong>Anyone can claim it.</Strong> Once past maturity, any address can settle the loan. The{" "}
          <Strong>entire</Strong> collateral is claimed and the debt is written off. No price is read and no partial
          return is calculated.
        </LI>
      </UL>
      <P>
        Whoever settles receives <Strong>0.5%</Strong> of the seized collateral, capped on-chain at 2%. That exists
        because settling costs only gas and hands the caller nothing otherwise, so without it nobody would bother and the
        pool would go on carrying a dead loan at full value.
      </P>

      <Callout kind="danger" title="Defaulting forfeits everything">
        Whole-collateral seizure is deliberately blunt. Your protection is the low LTV, not a partial claim. At a 35% LTV
        you would be giving up roughly three times what you borrowed, so defaulting only makes sense if the stock has
        fallen further than the cushion.
      </Callout>

      <Callout kind="note" title="A halt suspends defaults">
        Settlement is gated on liquidations being available, so during a halt nobody can claim your collateral even past
        maturity. Repayment stays open throughout. A halt should never be the moment the protocol takes something at a
        price nobody can verify.
      </Callout>

      <H2>For lenders</H2>
      <P>
        Fixed-term loans draw on the same pool as variable borrowing. The vault counts outstanding fixed{" "}
        <Strong>principal</Strong> but not the interest, which is recognised at the moment repayment actually arrives.
        Booking unearned interest early would let a lender deposit late, redeem early and collect on a loan that had not
        paid yet. See <DocLink href="/docs/earn">Earn</DocLink>.
      </P>
    </DocsPageShell>
  );
}
