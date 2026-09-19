import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, P, UL, LI, Code, Callout, Table, DocLink } from "@/components/docs/prose";

export default function LiquidationsPage() {
  return (
    <DocsPageShell slug="liquidations">
      <H2>What a liquidation is</H2>
      <P>
        Every borrower posts more collateral than they borrow. If the stock falls far enough, that cushion thins and the
        loan risks being worth less than what is owed, which would leave lenders holding the loss.
      </P>
      <P>
        So the protocol lets anyone step in: you repay part of a risky borrower&apos;s debt out of your own pocket, and
        in exchange you receive some of their collateral at a discount. The discount is your profit and it is the entire
        reason strangers bother. The borrower loses collateral but their loan is pulled back to safety, and lenders stay
        whole.
      </P>
      <P>
        Nobody is appointed to do this. It is an open bounty, permissionless by design, because a protocol that depends
        on a privileged liquidator is only as solvent as that liquidator&apos;s uptime.
      </P>

      <H2>When a position becomes liquidatable</H2>
      <P>
        When its health factor reaches 1.0, which is when debt equals collateral value at the market&apos;s liquidation
        threshold.
      </P>
      <Table
        head={["Market", "Max LTV", "Liquidation threshold", "Buffer"]}
        rows={[
          ["Tesla", "45%", "50%", "5pp"],
          ["NVIDIA", "50%", "55%", "5pp"],
          ["Apple", "55%", "60%", "5pp"],
          ["Microsoft", "55%", "60%", "5pp"],
          ["S&P 500 ETF", "60%", "65%", "5pp"],
        ]}
      />

      <H2>Parameters</H2>
      <Table
        head={["Parameter", "Value", "What it does"]}
        rows={[
          ["Liquidation bonus", "5%", "The discount the liquidator receives on seized collateral"],
          ["Close factor", "50%", "The most of a position's debt that can be repaid in one liquidation"],
        ]}
      />
      <P>
        The close factor means a single liquidation cannot wipe out an entire position. A borrower whose health factor
        dips below 1.0 loses at most half their debt in one event, and can restore the position by repaying or adding
        collateral before anyone comes back for the rest.
      </P>

      <H2>When liquidations cannot happen</H2>
      <P>
        This is the part specific to HaltGate. Liquidations are gated on the market being OPEN, so the moment a price
        feed pauses, every liquidation in that market stops.
      </P>
      <P>
        The reason is simple: liquidating against a stale price is not risk management, it is taking someone&apos;s
        collateral using a number that stopped being true. If a stock is halted pending a merger announcement, the last
        printed price carries no information about what the collateral is actually worth.
      </P>

      <Callout kind="note" title="RESUMING is a grace window">
        Liquidations do not switch back on the instant a fresh price lands. If they did, every position that drifted
        underwater during the freeze would become liquidatable simultaneously, at a price borrowers had no chance to
        react to. RESUMING gives them that chance: repayment and top-ups work, liquidations stay closed a beat longer.
      </Callout>

      <H2>Fixed-term loans are never liquidated</H2>
      <P>
        Nothing on this page applies to a <DocLink href="/docs/fixed-term">fixed-term loan</DocLink>. Those positions
        cannot be closed out on price at any point in their term. They are resolved by maturity instead, through a
        separate settlement path that reads no price at all.
      </P>

      <H2>Liquidating on HaltGate</H2>
      <P>
        Open the Liquidate tab on any market, paste an address, and the panel shows its health factor and whether it is
        currently liquidatable. You need USDG to repay with, and you receive the market&apos;s collateral token plus the
        bonus.
      </P>
      <UL>
        <LI>The transaction is simulated before you sign, so a revert surfaces as a readable message rather than a failed send.</LI>
        <LI>
          Matured fixed-term loans appear in the same tab, since closing them out is the same third-party keeper role.
          Settling one requires no capital at all, only gas.
        </LI>
        <LI>
          A position sitting at exactly <Code>1.0</Code> is liquidatable. There is no grace band below the threshold.
        </LI>
      </UL>
    </DocsPageShell>
  );
}
