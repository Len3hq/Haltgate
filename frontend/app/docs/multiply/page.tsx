import { DocsPageShell } from "@/components/docs/DocsPageShell";
import { H2, P, UL, LI, Strong, Code, Callout, Table, DocLink } from "@/components/docs/prose";

export default function MultiplyPage() {
  return (
    <DocsPageShell slug="multiply">
      <H2>How it works</H2>
      <P>
        Multiply builds a leveraged position in a single transaction by doing what you could do manually, just atomically
        and in a loop: supply collateral, borrow USDG against it, swap that USDG for more of the same stock, supply that
        too, and repeat until the position reaches the multiple you asked for.
      </P>
      <P>
        Because it is one transaction, either the whole loop lands or none of it does. You are never left halfway through
        with a borrow open and no collateral bought.
      </P>

      <H2>What the multiple means</H2>
      <P>
        A 2x position means you hold twice your own capital&apos;s worth of the stock, with the other half borrowed. Your
        gains and your losses are both roughly doubled against the price move.
      </P>

      <Callout kind="danger" title="This amplifies losses as much as gains">
        Unlike looping a staking token against its own underlying, your collateral and your debt here move independently.
        The stock can fall while your USDG debt stays exactly the same. Leverage genuinely increases risk in both
        directions, and these positions <Strong>can be liquidated</Strong>.
      </Callout>

      <H2>The ceiling</H2>
      <P>
        Each loop can only borrow against what the previous one supplied, so the achievable multiple is capped by the
        market&apos;s max LTV at <Code>1 / (1 - maxLTV)</Code>. This is an asymptote, not a target: no finite number of
        loops actually reaches it.
      </P>
      <Table
        head={["Market", "Max LTV", "Leverage ceiling"]}
        rows={[
          ["Tesla", "45%", "1.82x"],
          ["NVIDIA", "50%", "2.00x"],
          ["Apple", "55%", "2.22x"],
          ["Microsoft", "55%", "2.22x"],
          ["S&P 500 ETF", "60%", "2.50x"],
        ]}
      />
      <P>
        The contract carries a separate hard cap of 5x and a 10-iteration gas bound, neither of which any market here
        comes close to. The slider is bounded by the market&apos;s own live max LTV rather than a hardcoded number, so it
        stays correct if governance retunes the parameter.
      </P>

      <H2>Stopping short instead of reverting</H2>
      <P>
        Because the ceiling is an asymptote, insisting on hitting a target exactly would reject perfectly reasonable
        requests. Instead each pass is capped by the position&apos;s live LTV headroom and by the cash actually available
        in the vault, and the loop stops when it can no longer make progress.
      </P>
      <P>
        Your protection is <Code>minFinalCollateral</Code>: you specify the least you will accept, and the entire
        transaction reverts if the result lands below it. Each pass also rounds its borrow down so the loop never
        overshoots and hands you more risk than you asked for.
      </P>

      <Callout kind="warn" title="Thin liquidity stops the loop early">
        If the pool does not hold enough USDG, the loop stops at whatever multiple it managed rather than failing. The
        panel warns you when this is likely before you confirm.
      </Callout>

      <H2>Authorization</H2>
      <P>
        The zap opens your position on your behalf, which requires a one-time authorization per market. This works like
        an ERC-20 approval: you grant it explicitly, it only ever acts on your own position, and you can revoke it at any
        time.
      </P>
      <UL>
        <LI>The zap holds no funds and keeps no position of its own.</LI>
        <LI>Collateral and debt are credited to your address, never to the zap.</LI>
        <LI>Redeploying the zap changes its address, so authorizations do not carry over and you grant it once more.</LI>
      </UL>

      <H2>Halts block it</H2>
      <P>
        You cannot lever up into a stock whose price is currently frozen. The loop borrows and swaps, and both are gated
        on the market being OPEN, checked on-chain rather than hidden in the interface. See{" "}
        <DocLink href="/docs/halts">How halts work</DocLink>.
      </P>

      <H2>Unwinding</H2>
      <P>
        There is no one-click close yet. To unwind, repay USDG and withdraw collateral through{" "}
        <DocLink href="/docs/borrow">the borrow flow</DocLink>, which is the same position seen from the other side.
      </P>
    </DocsPageShell>
  );
}
