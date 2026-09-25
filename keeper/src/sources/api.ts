import { config } from "../config";
import type { Reading } from "../types";
import type { Watched } from "../watchlist";

// GET {base}/assets/{SYMBOL}/multiplier?network=XLayer
// Nothing pending:  {"currentMultiplier":1.0017,"newMultiplier":0,"activationDateTime":0,"reason":null}
//
// The shape while something IS pending has not been observed yet (nothing was
// pending on any ticker when this was written), so activationDateTime is
// parsed defensively: 0/null, unix seconds, unix ms, or an ISO string (the
// history endpoint uses ISO). Anything else is an error, never "not pending":
// a format change must surface, not read as an all-clear.

/// Unix seconds, null for "nothing scheduled". Throws on anything unrecognised.
export function parseActivation(value: unknown): number | null {
  if (value === null || value === undefined || value === 0 || value === "" || value === "0") return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value === "string") {
    if (/^\d+$/.test(value)) return parseActivation(Number(value));
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return Math.floor(ms / 1000);
  }
  throw new Error(`unrecognised activationDateTime: ${JSON.stringify(value)}`);
}

export function parseApiMultiplier(body: unknown, now: number): Reading {
  if (typeof body !== "object" || body === null) return { ok: false, error: "response is not an object" };
  const b = body as Record<string, unknown>;
  if (typeof b.currentMultiplier !== "number") return { ok: false, error: "missing currentMultiplier" };

  let activationTime: number | null;
  try {
    activationTime = parseActivation(b.activationDateTime);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  const newMultiplier = typeof b.newMultiplier === "number" && b.newMultiplier > 0 ? b.newMultiplier : null;
  const pending = activationTime !== null && activationTime > now && newMultiplier !== null;

  return {
    ok: true,
    pending,
    activationTime,
    newMultiplier: pending ? newMultiplier : null,
    currentMultiplier: b.currentMultiplier,
    reason: typeof b.reason === "string" ? b.reason : null,
  };
}

async function readOne(w: Watched, now: number): Promise<Reading> {
  const url = `${config.xstocksApiBase}/assets/${w.apiSymbol}/multiplier?network=${config.xstocksNetwork}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "haltgate-keeper" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return parseApiMultiplier(await res.json(), now);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function readApi(watchlist: Watched[], now: number): Promise<Map<string, Reading>> {
  const readings = await Promise.all(watchlist.map((w) => readOne(w, now)));
  return new Map(watchlist.map((w, i) => [w.ticker, readings[i]]));
}
