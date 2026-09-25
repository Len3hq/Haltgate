import { config } from "../config";

// Port of script/keeper/push_prices.py. The same quote feeds the resume price,
// so the first normal push after a resume can't trip the 20% deviation cap on
// a formula mismatch.

const WAD = 10n ** 18n;
const BPS = 10_000n;

export function deviationBps(oldPrice: bigint, newPrice: bigint): bigint {
  const diff = newPrice > oldPrice ? newPrice - oldPrice : oldPrice - newPrice;
  return (diff * BPS) / oldPrice;
}

/// Largest move toward target that setPrice() will accept. Rather than loosen
/// the oracle's guard for a big re-basing, step and converge over passes.
export function stepToward(current: bigint, target: bigint, maxBps: bigint): { push: bigint; aligned: boolean } {
  if (deviationBps(current, target) <= maxBps) return { push: target, aligned: true };
  const limit = (current * maxBps) / BPS;
  return { push: target > current ? current + limit : current - limit, aligned: false };
}

/// What a price pass should do for one market. Pure.
export function planPush(opts: {
  current: bigint;
  updatedAt: number;
  paused: boolean;
  target: bigint;
  maxBps: bigint;
  chainNow: number;
  refreshAfterSec: number;
}): { push: bigint | null; reason: string } {
  // A paused oracle is a halt in progress. setPrice() would revert, and
  // refreshing it would paper over the exact state being shown.
  if (opts.paused) return { push: null, reason: "halted, skipped" };
  const { push, aligned } = stepToward(opts.current, opts.target, opts.maxBps);
  const age = opts.chainNow - opts.updatedAt;
  if (push === opts.current) {
    return age >= opts.refreshAfterSec
      ? { push, reason: `refresh only, was ${Math.floor(age / 3600)}h old` }
      : { push: null, reason: "aligned, no send needed" };
  }
  return { push, reason: aligned ? "aligned" : `stepped (cap ${Number(opts.maxBps) / 100}%)` };
}

/// Finnhub's current price in WAD. Outside market hours this is the last
/// close, which is what we want: it keeps updatedAt fresh without inventing
/// movement that did not happen.
export async function fetchQuoteWad(ticker: string): Promise<bigint> {
  if (!config.finnhubApiKey) throw new Error("FINNHUB_API_KEY is not set");
  const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${config.finnhubApiKey}`;
  const res = await fetch(url, { headers: { "User-Agent": "haltgate-keeper" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
  const c = ((await res.json()) as { c?: number }).c;
  if (!c || c <= 0) throw new Error(`no price in Finnhub response for ${ticker}`);
  // Via micro-units: c * 1e18 as a float would lose precision.
  return BigInt(Math.round(c * 1e6)) * (WAD / 1_000_000n);
}

export const formatWad = (x: bigint) => (Number(x) / 1e18).toFixed(2);
