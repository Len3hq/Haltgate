import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, P, Strong, Code, Callout, Table, DocLink } from "@/components/docs/prose";

export default function ParametersPage() {
  return (
    <DocsPageShell slug="parameters">
      <H2>Per market</H2>
      <P>
        Risk parameters are set per asset, ordered by how far each one realistically moves. Both loan types are tiered,
        and the fixed-term cap always sits below the variable one.
      </P>
      <Table
        head={["Market", "Max LTV", "Liq. threshold", "Fixed-term LTV", "Leverage ceiling"]}
        rows={[
          ["Tesla", "45%", "50%", "30%", "1.82x"],
          ["NVIDIA", "50%", "55%", "35%", "2.00x"],
          ["Apple", "55%", "60%", "40%", "2.22x"],
          ["Microsoft", "55%", "60%", "40%", "2.22x"],
          ["S&P 500 ETF", "60%", "65%", "45%", "2.50x"],
        ]}
      />
      <P>
        A diversified index does not move like a single volatile name, which is why the S&amp;P market is the loosest and
        Tesla the tightest. The leverage ceiling is not a separate parameter: it falls out of max LTV as{" "}
        <Code>1 / (1 - maxLTV)</Code>.
      </P>

      <Callout kind="note" title="The fixed-term cap can never exceed the variable one">
        Enforced on-chain in both directions. Raising the fixed LTV above max LTV reverts, and lowering max LTV beneath
        the fixed LTV reverts too. A loan that nothing can liquidate must never be able to borrow more per unit of
        collateral than one that can.
      </Callout>

      <H2>Shared across all markets</H2>
      <Table
        head={["Parameter", "Value", "Notes"]}
        rows={[
          ["Liquidation bonus", "5%", "The liquidator's discount on seized collateral"],
          ["Close factor", "50%", "Most of a position's debt repayable in one liquidation"],
          ["Reserve factor", "10%", "Share of borrower interest retained by the protocol"],
          ["Max oracle staleness", "24 hours", "Price-dependent actions revert beyond this"],
          ["Settlement delay", "7 days", "Bounded on-chain between 1 and 30 days"],
        ]}
      />

      <H2>Fixed term</H2>
      <Table
        head={["Parameter", "Value"]}
        rows={[
          ["Rate", "8%/yr, simple interest"],
          ["Terms offered", "1, 7, 14 or 30 days"],
          ["Contract bounds", "1 to 30 days"],
          ["Settlement bounty", "0.5% of seized collateral"],
          ["Bounty ceiling", "2%, enforced on-chain"],
          ["Loans per address", "One at a time, per market"],
        ]}
      />
      <P>
        The bounty ceiling sits far below the 5% liquidation bonus on purpose. A liquidator has to front the debt; a
        settler fronts only gas. Paying them alike would make settling the more profitable action.
      </P>

      <H2>Interest rate curve</H2>
      <P>
        One kinked utilization curve is shared by every market. The curve is stateless, so sharing it costs nothing and
        keeps a single place to reason about rates.
      </P>
      <Table
        head={["Point", "Borrow rate"]}
        rows={[
          ["0% utilization", "0%/yr"],
          ["Up to the 80% kink", "rising to 10%/yr"],
          ["100% utilization", "up to 300%/yr"],
        ]}
      />
      <P>
        The steep segment above the kink exists to protect lender withdrawals. When a pool approaches fully drained,
        borrowing becomes expensive enough that some borrowers repay and new lenders are drawn in.
      </P>

      <H2>Swap module</H2>
      <Table
        head={["Parameter", "Value"]}
        rows={[
          ["Fee", "0.30%"],
          ["Fee ceiling", "5%, enforced on-chain"],
          ["Pricing", "Oracle-priced, halt-gated, with an independent freshness check"],
        ]}
      />
      <P>
        The swap module stands in for a DEX, since no real venue has liquidity for these mock tokens on testnet. It is
        what <DocLink href="/docs/multiply">Multiply</DocLink> routes through.
      </P>

      <H2>Contract-level ceilings</H2>
      <Table
        head={["Constant", "Value", "Why it exists"]}
        rows={[
          ["MAX_LEVERAGE", "5x", "Hard cap in the zap, above any market's real ceiling"],
          ["MAX_ITERATIONS", "10", "Gas bound on the multiply loop"],
          ["MIN_FIXED_TERM", "1 day", "Floor on fixed-term length"],
          ["MAX_FIXED_TERM", "30 days", "Ceiling on fixed-term length"],
          ["MAX_SETTLEMENT_BOUNTY", "2%", "Ceiling on the settler's cut"],
          ["MAX_FEE", "5%", "Ceiling on the swap fee"],
          ["MIN_SETTLEMENT_DELAY", "1 day", "Stops governance making halts instantly settleable"],
          ["MAX_SETTLEMENT_DELAY", "30 days", "Stops governance restoring an indefinite lockup"],
        ]}
      />
      <P>
        These are <Strong>constants, not settings</Strong>. Governance can move parameters within them but cannot change
        the ceilings themselves without deploying a new contract. See{" "}
        <DocLink href="/docs/governance">Governance</DocLink>.
      </P>
    </DocsPageShell>
  );
}
