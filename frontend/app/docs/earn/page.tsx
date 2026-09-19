import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, P, UL, LI, Strong, Code, Callout, Table, DocLink } from "@/components/docs/prose";

export default function EarnPage() {
  return (
    <DocsPageShell slug="earn">
      <H2>How it works</H2>
      <P>
        Supply USDG to a market&apos;s vault and receive <Code>hgUSDG</Code> shares in return. Borrowers pay interest
        into the vault, which makes each share redeemable for more USDG over time. You earn by holding the shares, not by
        claiming anything.
      </P>
      <P>
        Each of the five markets has its own separate vault. Supplying to the NVIDIA market funds NVIDIA borrowers only,
        and is exposed only to that market&apos;s risk.
      </P>

      <H2>Yield is the share price</H2>
      <P>
        There is no separately tracked supply rate that could drift out of sync with reality. The vault&apos;s total
        assets are simply the cash it holds, plus what is out on loan, plus outstanding fixed-term principal, minus
        protocol reserves. Divide by shares outstanding and you have the price.
      </P>
      <P>
        This matters because it means the yield you see is arithmetic rather than an estimate. It cannot be wrong about
        itself.
      </P>

      <Callout kind="note" title="Fixed-term interest arrives late, on purpose">
        The vault counts outstanding fixed-term <Strong>principal</Strong> but not the interest that loan will eventually
        pay. Booking unearned interest into the share price would let someone deposit late, redeem early and collect on a
        loan that had not paid yet. The interest lifts the price at the moment it actually arrives.
      </Callout>

      <H2>What you earn from</H2>
      <Table
        head={["Source", "How it reaches you"]}
        rows={[
          ["Variable borrowers", "Interest accrues continuously into the borrow index"],
          ["Fixed-term borrowers", "8%/yr, recognised in full when the loan is repaid"],
          ["Reserve factor", "10% of borrower interest is retained by the protocol, not paid to you"],
        ]}
      />

      <H2>Withdrawing</H2>
      <P>
        In normal conditions you can withdraw any amount up to the cash the vault currently holds. If utilization is
        high, some of your balance is out on loan and you may need to wait for repayments or for the rate curve to draw
        it back. That is the standard behaviour of any pooled lender.
      </P>

      <H2>Withdrawals during a halt</H2>
      <P>
        While a market is halted, redemptions are <Strong>blocked entirely</Strong>. This is the part of the design most
        worth understanding before you supply.
      </P>
      <P>
        A halt means the collateral backing the loans cannot currently be valued. If withdrawals stayed open, the first
        lenders out would redeem at a share price that has not yet recognised whatever the corporate action reveals, and
        whoever was slowest would absorb the entire loss. Freezing redemptions is what stops a halt from becoming a bank
        run.
      </P>

      <Callout kind="warn" title="Supplying means accepting this">
        Your capital can be locked for the duration of a halt. Deposits stay open throughout, but withdrawals do not.
        This is the trade for lending against an asset whose price can legitimately stop existing.
      </Callout>

      <H2>The escape hatch</H2>
      <P>
        A freeze with no time limit would be worse than the problem it solves, so there is a bound. If a market stays out
        of OPEN for longer than the settlement delay, currently <Strong>7 days</Strong>, anyone can force it into
        settlement and redemptions reopen on a pro-rata basis.
      </P>
      <P>
        Pro-rata means everyone draws the same proportion of available cash at the same price, so moving first buys you
        nothing but earlier access to a slice that was already yours. Full detail on{" "}
        <DocLink href="/docs/settlement">Settlement</DocLink>.
      </P>

      <H2>Risks</H2>
      <UL>
        <LI>
          <Strong>Bad debt.</Strong> If collateral falls faster than liquidators can act, the shortfall lands on the
          share price. Lenders are the residual claimant.
        </LI>
        <LI>
          <Strong>Lockup.</Strong> Withdrawals are unavailable during a halt, bounded by the settlement delay.
        </LI>
        <LI>
          <Strong>Fixed-term defaults.</Strong> A defaulted fixed loan leaves the protocol holding collateral rather than
          cash, and the share price stays understated until governance converts it.
        </LI>
        <LI>
          <Strong>Yield pauses during a halt</Strong>, because interest is frozen for borrowers at the same time.
        </LI>
      </UL>
    </DocsPageShell>
  );
}
