import { createServer } from "node:http";
import { encodeFunctionData } from "viem";
import { sendText } from "../alert";
import { Signer } from "../keeper/signer";
import { haltControllerAbi } from "../testnet/abis";
import { HaltState, buildKeeperMarkets, readMarkets, type MarketChain } from "../testnet/markets";

// Independent backstop, run as its own Railway service with its own small key,
// separate from the keeper's container. It calls only the permissionless
// HaltController.sync(), and only where a market has drifted from its oracle.
// If the keeper dies mid-halt, a paused oracle still ends up with a HALTED
// market, and a resumed one still moves the market on to RESUMING.
//
// It can't start or finish a halt (that needs the keeper and the multisig),
// and it can't do harm: sync() is callable by anyone and only ever moves the
// market to match its oracle.
//
//   npm run sync-watchdog [-- --dry-run]    one pass, then exit (local use)
//   WATCHDOG_INTERVAL_MS=10800000 ...        loop forever with /health (Railway)

/// Mirrors HaltController.sync(): true exactly when calling it would change
/// the state. Pure, so it's unit-tested against the contract's rules.
export function needsSync(c: Pick<MarketChain, "state" | "oraclePaused">): boolean {
  const haltedLike = c.state === HaltState.HALTED || c.state === HaltState.SETTLING;
  if (c.oraclePaused) return !haltedLike; // any state -> HALTED, except SETTLING stays
  return haltedLike; // HALTED or SETTLING -> RESUMING
}

type PassResult = { at: number; drifted: number; failed: number; lines: string[] };

async function pass(signer: Signer | null): Promise<PassResult> {
  const markets = buildKeeperMarkets();
  const chains = await readMarkets(markets);
  const lines: string[] = [];
  let drifted = 0;
  let failed = 0;

  for (const m of markets) {
    const c = chains.get(m.key)!;
    if (c instanceof Error) {
      lines.push(`${m.key.padEnd(5)} READ FAILED: ${c.message}`);
      failed++;
      continue;
    }
    const line = `${m.key.padEnd(5)} ${HaltState[c.state].padEnd(9)} oracle ${c.oraclePaused ? "paused" : "live  "}`;
    if (!needsSync(c)) {
      lines.push(`${line}  in step`);
      continue;
    }
    drifted++;
    if (!signer) {
      lines.push(`${line}  DRIFTED, would call sync()`);
      continue;
    }
    try {
      const r = await signer.send(
        m.haltController,
        encodeFunctionData({ abi: haltControllerAbi, functionName: "sync" }),
        `${m.key} sync`,
      );
      lines.push(`${line}  DRIFTED, sync() sent: ${r.transactionHash}`);
    } catch (err) {
      lines.push(`${line}  DRIFTED, sync() FAILED: ${(err as Error).message}`);
      failed++;
    }
  }
  return { at: Math.floor(Date.now() / 1000), drifted, failed, lines };
}

/// A drift the watchdog had to fix means the keeper missed it: always alert.
async function report(r: PassResult) {
  for (const l of r.lines) console.log(l);
  console.log(`${r.drifted} drifted, ${r.failed} failed`);
  const notable = r.lines.filter((l) => /DRIFTED|FAILED/.test(l));
  if (notable.length > 0) await sendText([`🛟 Watchdog: ${r.drifted} drifted, ${r.failed} failed`, ...notable]);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const key = process.env.WATCHDOG_PRIVATE_KEY?.trim();
  const signer = key && !dryRun ? new Signer(key) : null;
  const intervalMs = Number(process.env.WATCHDOG_INTERVAL_MS || 0);

  if (!intervalMs) {
    if (!key && !dryRun) {
      console.log("WATCHDOG_PRIVATE_KEY not set; nothing sent. Pass --dry-run to only check.");
      return;
    }
    const r = await pass(signer);
    await report(r);
    // Exit non-zero if it had to act, so a scheduler notices.
    if (r.failed > 0 || (r.drifted > 0 && !dryRun)) process.exit(1);
    return;
  }

  // Loop mode, for an always-on service.
  if (!signer) console.log("WATCHDOG_PRIVATE_KEY not set: checking only, nothing will be sent");
  console.log(JSON.stringify({ msg: "watchdog starting", signer: signer?.address ?? null, intervalMs }));
  const startedAt = Math.floor(Date.now() / 1000);
  let last: PassResult | null = null;

  const server = createServer((req, res) => {
    const now = Math.floor(Date.now() / 1000);
    const staleAfter = (2 * intervalMs) / 1000 + 300;
    const age = now - (last?.at ?? startedAt);
    const ok = age <= staleAfter;
    res.writeHead(req.url === "/health" ? (ok ? 200 : 503) : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok, signer: signer?.address ?? null, lastRun: last, ageSec: age }, null, 2));
  });
  server.listen(Number(process.env.PORT || 8080));

  let timer: NodeJS.Timeout | undefined;
  const loop = async () => {
    try {
      last = await pass(signer);
      await report(last);
    } catch (err) {
      console.log(JSON.stringify({ msg: "watchdog pass failed", error: (err as Error).message }));
      await sendText([`🛟 Watchdog: pass failed: ${(err as Error).message}`]);
    }
    timer = setTimeout(loop, intervalMs);
  };
  void loop();

  const shutdown = () => {
    clearTimeout(timer);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

if (process.argv[1]?.endsWith("sync-watchdog.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
