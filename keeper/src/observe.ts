import type { Pending, Reading, SourceName, SourceState, TickerState, WatchEvent } from "./types";

// Pure: previous state + a fresh reading -> next state + what changed. No I/O,
// no clock, so every transition is unit-testable.

const REL_TOLERANCE = 1e-12;

export function sameMultiplier(a: number, b: number): boolean {
  return Math.abs(a - b) <= REL_TOLERANCE * Math.max(Math.abs(a), Math.abs(b));
}

export function stepSource(
  prev: SourceState | undefined,
  reading: Reading,
  now: number,
  ticker: string,
  source: SourceName,
): { next: SourceState; events: WatchEvent[] } {
  const events: WatchEvent[] = [];
  const base: SourceState = prev ?? { pending: null, down: null, lastOkAt: null, lastReading: null };
  const ev = (type: WatchEvent["type"], detail: Record<string, unknown> = {}) =>
    events.push({ at: now, ticker, source, type, ...detail });

  if (!reading.ok) {
    // Keep whatever was pending: a source going quiet says nothing about the
    // schedule, and forgetting it would log a spurious "scheduled" on recovery.
    if (!base.down) ev("source-down", { error: reading.error });
    return {
      next: { ...base, down: base.down ?? { since: now, error: reading.error }, lastReading: reading },
      events,
    };
  }

  if (base.down) ev("source-recovered", { downForSec: now - base.down.since });

  const was = base.pending;
  let pending: Pending | null = null;

  if (reading.pending && reading.activationTime !== null && reading.newMultiplier !== null) {
    const unchanged =
      was && was.activationTime === reading.activationTime && sameMultiplier(was.newMultiplier, reading.newMultiplier);
    if (unchanged) {
      pending = { ...was, reason: was.reason ?? reading.reason };
    } else {
      pending = {
        activationTime: reading.activationTime,
        newMultiplier: reading.newMultiplier,
        reason: reading.reason,
        firstSeenAt: now,
        seenOnStartup: prev === undefined,
      };
      const detail = {
        activationTime: pending.activationTime,
        newMultiplier: pending.newMultiplier,
        currentMultiplier: reading.currentMultiplier,
        reason: pending.reason,
        leadSec: pending.activationTime - now,
        seenOnStartup: pending.seenOnStartup,
      };
      if (was) {
        ev("rescheduled", { ...detail, previousActivationTime: was.activationTime, previousMultiplier: was.newMultiplier });
      } else {
        ev("scheduled", detail);
      }
    }
  } else if (was) {
    if (now >= was.activationTime) {
      ev("activated", {
        activationTime: was.activationTime,
        newMultiplier: was.newMultiplier,
        currentMultiplier: reading.currentMultiplier,
        // How long after activation this source stopped reporting it as
        // pending. On-chain this is ~one poll by construction; for the API it
        // is a real measurement.
        clearedAfterSec: now - was.activationTime,
        multiplierApplied: sameMultiplier(reading.currentMultiplier, was.newMultiplier),
        reason: was.reason,
      });
    } else {
      ev("cancelled", { activationTime: was.activationTime, newMultiplier: was.newMultiplier, reason: was.reason });
    }
  }

  return { next: { pending, down: null, lastOkAt: now, lastReading: reading }, events };
}

/// Compares the two sources once both have been stepped. Returns a stable key
/// describing the mismatch, or null when they agree.
export function disagreementKey(
  t: TickerState,
  now: number,
  activationToleranceSec: number,
  soloPendingAlarmSec: number,
): string | null {
  const a = t.onchain;
  const b = t.api;
  if (!a || !b || a.down || b.down) return null;

  if (a.pending && b.pending) {
    if (Math.abs(a.pending.activationTime - b.pending.activationTime) > activationToleranceSec) {
      return `activation differs: onchain ${a.pending.activationTime} vs api ${b.pending.activationTime}`;
    }
    if (!sameMultiplier(a.pending.newMultiplier, b.pending.newMultiplier)) {
      return `multiplier differs: onchain ${a.pending.newMultiplier} vs api ${b.pending.newMultiplier}`;
    }
    return null;
  }

  // One source ahead of the other is expected days out. Close to activation it
  // means the halt would be driven by a single source, which is worth knowing.
  const solo = a.pending ? { who: "onchain", p: a.pending } : b.pending ? { who: "api", p: b.pending } : null;
  if (solo && solo.p.activationTime - now <= soloPendingAlarmSec) {
    return `only ${solo.who} shows the action due at ${solo.p.activationTime}`;
  }
  return null;
}

export function stepTicker(
  prev: TickerState | undefined,
  readings: Partial<Record<SourceName, Reading>>,
  now: number,
  ticker: string,
  opts: { activationToleranceSec: number; soloPendingAlarmSec: number },
): { next: TickerState; events: WatchEvent[] } {
  const next: TickerState = { onchain: prev?.onchain, api: prev?.api, disagreement: prev?.disagreement ?? null };
  const events: WatchEvent[] = [];

  for (const source of ["onchain", "api"] as const) {
    const reading = readings[source];
    if (!reading) continue;
    const r = stepSource(prev?.[source], reading, now, ticker, source);
    next[source] = r.next;
    events.push(...r.events);
  }

  const key = disagreementKey(next, now, opts.activationToleranceSec, opts.soloPendingAlarmSec);
  if (key !== next.disagreement) {
    if (key) events.push({ at: now, ticker, type: "disagreement", detail: key });
    else events.push({ at: now, ticker, type: "disagreement-resolved", previous: next.disagreement });
    next.disagreement = key;
  }
  return { next, events };
}
