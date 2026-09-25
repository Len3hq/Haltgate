import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, P, UL, LI, Strong, Code, Callout, Table, DocLink } from "@/components/docs/prose";

export default function GovernancePage() {
  return (
    <DocsPageShell slug="governance">
      <H2>Three tiers, matched to urgency</H2>
      <P>
        Different powers need different speeds. A halt has to be able to happen immediately; changing a risk parameter
        should not. So authority is split three ways rather than concentrated behind one switch.
      </P>

      <Table
        head={["Tier", "Who", "What it controls"]}
        rows={[
          ["Permissionless", "Anyone", "sync(), forceSettle(), liquidate(), settleMatured()"],
          ["Keeper", "One key, run by the keeper service", "beginHalting(), completeResume()"],
          ["Multisig", "Signers, no delay", "The oracle and the swap module"],
          ["Timelock", "Multisig, behind a delay", "Market, LenderVault, HaltController, InterestRateModel"],
        ]}
      />

      <H2>Permissionless</H2>
      <P>
        The actions that protect people are open to everyone. Moving a market into a halt when the oracle has paused,
        forcing settlement once the deadline passes, liquidating an unsafe position and settling a matured fixed-term
        loan all require no permission at all.
      </P>
      <P>
        This is deliberate. A safety mechanism that depends on a privileged keeper is only as reliable as that
        keeper&apos;s uptime, and a guarantee that depends on the same governance that let a market get stuck is not a
        guarantee.
      </P>

      <H2>The keeper</H2>
      <P>
        Each halt controller names one keeper, which can do exactly two things: start a halt early{" "}
        (<Code>beginHalting()</Code>) and finish one (<Code>completeResume()</Code>). It is run by an automated service
        that watches the issuer&apos;s corporate-action schedule; see{" "}
        <DocLink href="/docs/halts">How halts work</DocLink>. To pause and resume the oracle the same key is also a
        multisig signer.
      </P>
      <P>
        The key is dedicated: it was given its roles through the multisig and the timelock like any other change, the
        deployer key is not on any server, and either role can be revoked without redeploying anything. A second,
        separate key belongs to a watchdog that can only call the permissionless <Code>sync()</Code>.
      </P>
      <P>
        What the keeper is trusted with is <em>when</em> to halt and reopen. On mainnet the halt controller reads the
        schedule and checks solvency itself, which reduces the keeper to a convenience rather than a trusted party. See
        the <DocLink href="/docs/roadmap">Roadmap</DocLink>.
      </P>

      <H2>Multisig, no delay</H2>
      <P>
        The oracle and the swap module sit directly behind a multisig with no timelock. These are the fast levers: if a
        feed needs pausing or a swap fee needs adjusting, waiting out a delay would defeat the point.
      </P>

      <H2>Timelock</H2>
      <P>
        Everything that changes how risk is calculated sits behind a timelock, proposed by the multisig. Risk
        parameters, contract ownership and the rate model all take this path, so any change is visible on-chain before it
        takes effect.
      </P>

      <H2>What governance cannot do</H2>
      <P>Several limits are constants in the contracts rather than settings, so no governance action can move them.</P>
      <UL>
        <LI>
          <Strong>It cannot block repayment.</Strong> There is no state and no parameter that closes the repay path.
        </LI>
        <LI>
          <Strong>It cannot remove the settlement escape hatch.</Strong> The delay is bounded between 1 and 30 days. The
          floor stops it being set near zero; the ceiling stops an indefinite lockup being quietly restored.
        </LI>
        <LI>
          <Strong>It cannot let a fixed-term loan out-borrow a variable one.</Strong> Enforced in both directions, so
          neither raising the fixed LTV nor lowering the variable one can invert the relationship.
        </LI>
        <LI>
          <Strong>It cannot exceed the hard ceilings</Strong> on leverage, swap fee, settlement bounty or fixed-term
          length. See <DocLink href="/docs/parameters">Risk parameters</DocLink>.
        </LI>
        <LI>
          <Strong>It cannot skip a halt state.</Strong> Transitions follow a fixed sequence; there is no override.
        </LI>
      </UL>

      <Callout kind="warn" title="Testnet configuration is not a security boundary">
        The multisig is currently <Strong>1-of-1</Strong> and the timelock delay is <Code>10 minutes</Code>. Both are
        real contracts wired correctly, but at those parameters neither provides meaningful protection. It also means the
        keeper key, as a signer, could act alone. A production deployment needs real co-signers and a delay measured in
        days.
      </Callout>

      <H2>Upgrades</H2>
      <P>
        The contracts are not proxied and cannot be upgraded in place. Changing core logic means deploying a new{" "}
        <Code>Market</Code> and <Code>LenderVault</Code> pair, because each holds an immutable reference to the other.
        Positions are unwound and liquidity migrated before the switch.
      </P>
      <P>
        This is a deliberate trade: no upgrade key means no ability to quietly change the rules under anyone, at the cost
        of a heavier process for every change.
      </P>
    </DocsPageShell>
  );
}
