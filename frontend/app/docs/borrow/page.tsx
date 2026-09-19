import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, P, UL, LI, Strong, Code, Callout, Table, DocLink } from "@/components/docs/prose";

export default function BorrowPage() {
  return (
    <DocsPageShell slug="borrow">
      <H2>How it works</H2>
      <P>
        Supply a tokenized stock as collateral, then borrow USDG against it. The rate floats with how heavily the pool is
        being used, and you can repay any amount at any time. Withdraw your collateral once the debt is clear, or
        partially while you stay within the borrowing limit.
      </P>

      <H2>Borrowing limit</H2>
      <P>
        Each market has a <Strong>max LTV</Strong>, the largest fraction of your collateral&apos;s value you are allowed
        to borrow. It is set per asset rather than globally, because a broad index does not move like a single volatile
        name.
      </P>
      <Table
        head={["Market", "Max LTV", "Liquidation threshold"]}
        rows={[
          ["Tesla", "45%", "50%"],
          ["NVIDIA", "50%", "55%"],
          ["Apple", "55%", "60%"],
          ["Microsoft", "55%", "60%"],
          ["S&P 500 ETF", "60%", "65%"],
        ]}
      />
      <P>
        Max LTV is the ceiling at the moment you borrow. The liquidation threshold is the higher line where your position
        becomes liquidatable. The gap between them is your buffer against a price move.
      </P>

      <H2>Health factor</H2>
      <P>
        Health factor is the single number to watch. It is the ratio of what your collateral is worth at the liquidation
        threshold to what you owe.
      </P>
      <UL>
        <LI>
          <Strong>Above 1.0</Strong>, your position is safe.
        </LI>
        <LI>
          <Strong>At or below 1.0</Strong>, anyone can liquidate part of it.
        </LI>
        <LI>
          Borrowing the maximum on NVIDIA leaves you at roughly <Code>1.10</Code>, because the threshold is 55% and the
          borrow ceiling is 50%.
        </LI>
      </UL>
      <P>
        Health factor moves when the price moves, when interest accrues, and when you supply, borrow or repay. It does
        not move during a halt, because interest is frozen and no new borrowing is possible.
      </P>

      <H2>Interest</H2>
      <P>
        The rate comes from a kinked utilization curve shared by every market. Utilization is the share of the pool
        currently borrowed.
      </P>
      <Table
        head={["Segment", "Rate"]}
        rows={[
          ["At 0% utilization", "0%/yr"],
          ["Rising to the 80% kink", "up to 10%/yr"],
          ["Above the kink", "steepens sharply, up to 300%/yr at full utilization"],
        ]}
      />
      <P>
        The steep segment above the kink is not a punishment, it is what keeps a pool from being fully drained. When
        borrowing gets expensive, some borrowers repay and lenders are drawn in, which restores the cash that lenders
        need to be able to withdraw.
      </P>
      <P>
        Interest accrues lazily against a running index rather than being written to every position on a schedule, so the
        cost of accrual does not grow with the number of borrowers.
      </P>

      <Callout kind="note" title="Interest stops during a halt">
        The index stops advancing the moment a market leaves OPEN and continues from the same point when it returns. You
        are not charged for a window in which you could not act. See <DocLink href="/docs/halts">How halts work</DocLink>.
      </Callout>

      <H2>Withdrawing collateral</H2>
      <P>
        With no debt, you can withdraw everything. With debt outstanding, you can withdraw down to the point that keeps
        you inside the max LTV, and the transaction reverts if you ask for more. Withdrawal also requires a fresh price,
        so it is unavailable during a halt: releasing collateral when nobody can value it is exactly the kind of action
        the halt exists to stop.
      </P>

      <Callout kind="warn" title="This position can be liquidated">
        Variable-rate borrowing carries liquidation risk whenever the price moves against you. If you want a loan that
        cannot be closed out on price at all, see <DocLink href="/docs/fixed-term">Fixed Term</DocLink>.
      </Callout>
    </DocsPageShell>
  );
}
