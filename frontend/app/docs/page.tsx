import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, P, UL, LI, Strong, Code, Callout, DocLink, Table } from "@/components/docs/prose";

export default function IntroductionPage() {
  return (
    <DocsPageShell slug="">
      <H2>The problem</H2>
      <P>
        Tokenized stocks trade around the clock, but the companies behind them do not. A stock split, a merger, a
        dividend or a trading suspension makes the old price wrong, and the feed that publishes it responds by pausing
        rather than by publishing something it cannot stand behind.
      </P>
      <P>
        A normal lending protocol has no idea this happened. It keeps reading the last price it was given and keeps
        acting on it: it will happily liquidate a position using a number that stopped being true hours ago, and it will
        let someone borrow against collateral whose value nobody can currently establish. The borrower loses their
        collateral to a stale quote, and there is no recourse because the contract did exactly what it was told.
      </P>

      <H2>What HaltGate does</H2>
      <P>
        HaltGate treats the pause itself as a first-class signal. A dedicated state machine watches the oracle, and when
        the price stops being trustworthy the protocol stops taking actions that depend on trusting it. Liquidations
        stop. New borrowing stops. Interest stops accruing, because charging for a window the borrower cannot act in is
        not a fee, it is a penalty for something outside their control.
      </P>
      <P>
        One thing never stops: <Strong>repayment</Strong>. Paying down a loan only ever reduces risk, so it stays open in
        every state, including a full halt.
      </P>

      <Callout kind="note" title="The one sentence version">
        Every action that could hurt someone when the price is wrong is gated on the price being right. Every action
        that helps regardless stays open.
      </Callout>

      <H2>What you can do</H2>
      <Table
        head={["Product", "What it is", "Can it be liquidated?"]}
        rows={[
          [
            <DocLink key="b" href="/docs/borrow">Borrow</DocLink>,
            "Supply a tokenized stock, borrow USDG against it at a floating rate",
            "Yes",
          ],
          [
            <DocLink key="f" href="/docs/fixed-term">Fixed Term</DocLink>,
            "Lock a rate and an end date, with maturity replacing liquidation entirely",
            "No, at any price",
          ],
          [
            <DocLink key="m" href="/docs/multiply">Multiply</DocLink>,
            "Loop into amplified exposure in one transaction",
            "Yes",
          ],
          [
            <DocLink key="e" href="/docs/earn">Earn</DocLink>,
            "Supply USDG and earn what borrowers pay",
            "Not applicable",
          ],
        ]}
      />

      <H2>How it is put together</H2>
      <UL>
        <LI>
          <Strong>Isolated markets.</Strong> Five stocks, each with its own collateral token, oracle, halt controller,
          lender vault and market contract. Halting one leaves the other four trading normally, which is the only way to
          actually demonstrate that halts are per-asset rather than protocol-wide.
        </LI>
        <LI>
          <Strong>The vault holds the cash, the market holds the risk.</Strong> <Code>Market</Code> never custodies
          lender deposits. It tracks collateral, debt and interest; <Code>LenderVault</Code> is a standard ERC-4626 vault
          that holds the USDG.
        </LI>
        <LI>
          <Strong>Nothing is unbounded.</Strong> A halt cannot last forever, governance cannot remove the escape hatch,
          and the parameters that matter have on-chain ceilings rather than social conventions.
        </LI>
      </UL>

      <Callout kind="warn" title="This is a testnet deployment">
        HaltGate runs on X Layer testnet (chain ID 1952). The collateral tokens and the oracle are mocks, the stablecoin
        is real testnet USDG, and none of it has been audited. See <DocLink href="/docs/testnet">Using the testnet</DocLink>{" "}
        for exactly what is real and what is not.
      </Callout>
    </DocsPageShell>
  );
}
