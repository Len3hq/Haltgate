import { config } from "./config";
import { parseActivation } from "./sources/api";
import { mainnetClient, xStockAbi } from "./sources/onchain";
import { buildWatchlist } from "./watchlist";

// Measures lead time for PAST corporate actions, so Phase 0 does not have to
// wait a quarter for the next round of dividends.
//
// For each activation time in the xStocks API history, binary-search archive
// state for the first block where the token's newMultiplierActivationTime
// equals it. That block is when Backed scheduled the action on-chain; the gap
// to activation is the lead time.
//
// Why state and not logs: every public X Layer RPC caps eth_getLogs at 100 to
// 1,000 blocks, and blocks are ~1s, so a 7-day window is ~6,000 log requests.
// The binary search is ~20 eth_calls. The window is 8 days because the contract
// requires activation before the end of the current weekly fee period, so an
// action can never be scheduled more than 7 days ahead.
//
//   npm run backfill                       all tokens, last 10 actions each
//   npm run backfill -- --tickers NVDA,SPY --limit 3

const SEARCH_WINDOW_SEC = 8 * 86400;
const PAUSE_MS = 150; // stay under the public RPC's rate limit

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function blockTimestamp(n: bigint): Promise<number> {
  await sleep(PAUSE_MS);
  return Number((await mainnetClient.getBlock({ blockNumber: n })).timestamp);
}

/// Latest block with timestamp <= ts. X Layer runs ~1 block/second, so a few
/// corrective jumps land on it; a final walk makes it exact.
async function blockAtOrBefore(ts: number, latest: bigint, latestTs: number): Promise<bigint> {
  let n = latest - BigInt(latestTs - ts);
  for (let i = 0; i < 8; i++) {
    const diff = ts - (await blockTimestamp(n));
    if (Math.abs(diff) <= 2) break;
    n += BigInt(diff);
  }
  while ((await blockTimestamp(n)) > ts) n -= 1n;
  while ((await blockTimestamp(n + 1n)) <= ts) n += 1n;
  return n;
}

async function activationAt(token: `0x${string}`, block: bigint): Promise<number | null> {
  await sleep(PAUSE_MS);
  try {
    const v = await mainnetClient.readContract({
      address: token,
      abi: xStockAbi,
      functionName: "newMultiplierActivationTime",
      blockNumber: block,
    });
    return Number(v);
  } catch {
    return null; // before deployment, or an older implementation without the field
  }
}

type History = { reason: string; multiplier: number; activationDateTime: string };

async function history(apiSymbol: string, limit: number): Promise<History[]> {
  const url = `${config.xstocksApiBase}/assets/${apiSymbol}/multiplier/history?page=0&pageSize=${limit}&network=${config.xstocksNetwork}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${apiSymbol} history`);
  return ((await res.json()) as { nodes: History[] }).nodes;
}

async function main() {
  const limit = Number(arg("limit") ?? 10);
  const only = arg("tickers")?.toUpperCase().split(",");
  const tokens = buildWatchlist().filter((w) => w.raw && (!only || only.includes(w.ticker)));

  const latestBlock = await mainnetClient.getBlock();
  const latest = latestBlock.number;
  const latestTs = Number(latestBlock.timestamp);

  console.log(["ticker", "reason", "activation (UTC)", "scheduled on-chain (UTC)", "lead", "block"].join("\t"));

  for (const w of tokens) {
    let entries: History[];
    try {
      entries = await history(w.apiSymbol, limit);
    } catch (err) {
      console.log(`${w.ticker}\t(api history failed: ${(err as Error).message})`);
      continue;
    }

    for (const e of entries) {
      const act = parseActivation(e.activationDateTime);
      if (act === null || act >= latestTs) continue;
      const row = [w.ticker, e.reason, new Date(act * 1000).toISOString()];

      // hi: last block before activation. The schedule must be visible there
      // if it was ever announced in advance.
      const hi0 = await blockAtOrBefore(act - 1, latest, latestTs);
      const atHi = await activationAt(w.raw!, hi0);
      if (atHi === null) {
        console.log([...row, "field not present then (older implementation)", "—", "—"].join("\t"));
        continue;
      }
      if (atHi !== act) {
        console.log([...row, `not scheduled in advance (value was ${atHi})`, "—", "—"].join("\t"));
        continue;
      }
      let lo = await blockAtOrBefore(act - SEARCH_WINDOW_SEC, latest, latestTs);
      let hi = hi0;
      // Invariant: value at hi == act, value at lo != act.
      while (hi - lo > 1n) {
        const mid = (lo + hi) / 2n;
        if ((await activationAt(w.raw!, mid)) === act) hi = mid;
        else lo = mid;
      }
      const ts = await blockTimestamp(hi);
      const leadH = ((act - ts) / 3600).toFixed(2);
      console.log([...row, new Date(ts * 1000).toISOString(), `${leadH}h`, hi.toString()].join("\t"));
    }
  }
  console.log(
    "\n'not scheduled in advance': the update was applied at or after activation with no\n" +
      "pending schedule, so the chain gave no warning. 'field not present': the token ran an\n" +
      "implementation without newMultiplierActivationTime at the time, so nothing to measure.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
