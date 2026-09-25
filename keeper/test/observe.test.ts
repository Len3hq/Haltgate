import assert from "node:assert/strict";
import { test } from "node:test";
import { stepSource, stepTicker } from "../src/observe";
import type { Reading, SourceState } from "../src/types";

const T = 1_789_000_200; // 2026-09-10 00:30 UTC, a real NVDA activation
const opts = { activationToleranceSec: 60, soloPendingAlarmSec: 3600 };

const idle = (current = 1.0009): Reading => ({
  ok: true,
  pending: false,
  activationTime: null,
  newMultiplier: null,
  currentMultiplier: current,
  reason: null,
});
const pending = (activationTime = T, newMultiplier = 1.0017, reason: string | null = "Dividend"): Reading => ({
  ok: true,
  pending: true,
  activationTime,
  newMultiplier,
  currentMultiplier: 1.0009,
  reason,
});

function run(readings: Array<[number, Reading]>, start?: SourceState) {
  let s = start;
  const all = [];
  for (const [now, r] of readings) {
    const out = stepSource(s, r, now, "NVDA", "onchain");
    s = out.next;
    all.push(...out.events);
  }
  return { state: s!, events: all };
}

test("first sighting of a pending action is 'scheduled' with its lead time", () => {
  const { events } = run([
    [T - 20_000, idle()],
    [T - 14_400, pending()],
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "scheduled");
  assert.equal(events[0].leadSec, 14_400);
  assert.equal(events[0].seenOnStartup, false);
});

test("already pending on the very first look is flagged as a lower bound", () => {
  const { events } = run([[T - 3600, pending()]]);
  assert.equal(events[0].type, "scheduled");
  assert.equal(events[0].seenOnStartup, true);
});

test("an unchanged pending action emits nothing on later ticks", () => {
  const { events } = run([
    [T - 7200, idle()],
    [T - 7000, pending()],
    [T - 6000, pending()],
    [T - 5000, pending()],
  ]);
  assert.deepEqual(
    events.map((e) => e.type),
    ["scheduled"],
  );
});

test("clearing at or after activation is 'activated', and checks the multiplier landed", () => {
  const { events } = run([
    [T - 7200, idle()],
    [T - 7000, pending()],
    [T + 45, idle(1.0017)],
  ]);
  const act = events.find((e) => e.type === "activated")!;
  assert.equal(act.clearedAfterSec, 45);
  assert.equal(act.multiplierApplied, true);
});

test("clearing before activation is 'cancelled', not 'activated'", () => {
  const { events } = run([
    [T - 7200, idle()],
    [T - 7000, pending()],
    [T - 3000, idle()],
  ]);
  assert.equal(events.at(-1)!.type, "cancelled");
});

test("a changed activation time or multiplier is 'rescheduled'", () => {
  const { events } = run([
    [T - 9000, idle()],
    [T - 8000, pending()],
    [T - 7000, pending(T + 86_400)],
    [T - 6000, pending(T + 86_400, 1.002)],
  ]);
  assert.deepEqual(
    events.map((e) => e.type),
    ["scheduled", "rescheduled", "rescheduled"],
  );
  assert.equal(events[1].previousActivationTime, T);
});

test("a failing source keeps the pending action and does not re-announce it on recovery", () => {
  const { events } = run([
    [T - 9000, idle()],
    [T - 8000, pending()],
    [T - 7000, { ok: false, error: "timeout" }],
    [T - 6900, { ok: false, error: "timeout" }],
    [T - 6000, pending()],
  ]);
  assert.deepEqual(
    events.map((e) => e.type),
    ["scheduled", "source-down", "source-recovered"],
  );
});

test("sources pending with different activation times disagree; agreeing resolves it", () => {
  let t = stepTicker(undefined, { onchain: idle(), api: idle() }, T - 9000, "NVDA", opts).next;
  let r = stepTicker(t, { onchain: pending(T), api: pending(T + 3600) }, T - 8000, "NVDA", opts);
  assert.ok(r.events.some((e) => e.type === "disagreement"));
  t = r.next;
  r = stepTicker(t, { onchain: pending(T), api: pending(T) }, T - 7000, "NVDA", opts);
  assert.ok(r.events.some((e) => e.type === "disagreement-resolved"));
});

test("one source ahead of the other is fine days out, but flagged near activation", () => {
  const t = stepTicker(undefined, { onchain: idle(), api: idle() }, T - 90_000, "NVDA", opts).next;
  const early = stepTicker(t, { onchain: idle(), api: pending() }, T - 80_000, "NVDA", opts);
  assert.ok(!early.events.some((e) => e.type === "disagreement"));
  const late = stepTicker(early.next, { onchain: idle(), api: pending() }, T - 1800, "NVDA", opts);
  assert.ok(late.events.some((e) => e.type === "disagreement"));
});
