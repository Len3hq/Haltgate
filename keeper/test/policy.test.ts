import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, type HaltRecord, type Signal, type Windows } from "../src/keeper/policy";
import { planPush, stepToward } from "../src/keeper/prices";
import { HaltState, type MarketChain } from "../src/testnet/markets";

const T = 1_789_000_200; // 2026-09-10 00:30 UTC
const W: Windows = {
  haltingLeadSec: 7200,
  haltBufferSec: 900,
  resumeCooldownSec: 1800,
  stuckAfterSec: 6 * 3600,
  adoptSlackSec: 1800,
};
const WAD = 10n ** 18n;

const chain = (over: Partial<MarketChain> = {}): MarketChain => ({
  state: HaltState.OPEN,
  haltStartedAt: 0,
  price: 180n * WAD,
  priceUpdatedAt: T - 600,
  oraclePaused: false,
  solvent: true,
  maxOracleStaleness: 86_400,
  blockTs: T,
  ...over,
});

const signal = (over: Partial<Signal> = {}): Signal => ({
  pending: { activationTime: T, newMultiplier: 1.0017, reason: "Dividend", source: "onchain" },
  currentMultiplier: 1.0009,
  allSourcesOk: true,
  ...over,
});
const none = (over: Partial<Signal> = {}): Signal => signal({ pending: null, ...over });

const record = (over: Partial<HaltRecord> = {}): HaltRecord => ({
  activationTime: T,
  newMultiplier: 1.0017,
  reason: "Dividend",
  source: "onchain",
  startedAt: T - 7200,
  ...over,
});

// --- the happy path, one row at a time -------------------------------------

test("OPEN, action further out than the lead: nothing yet", () => {
  const d = decide(chain(), signal(), null, T - 3 * 3600, W);
  assert.deepEqual(d.steps, []);
  assert.equal(d.record, null);
});

test("OPEN, inside the lead window: beginHalting, and the keeper starts a record", () => {
  const d = decide(chain(), signal(), null, T - 7000, W);
  assert.deepEqual(d.steps, ["beginHalting"]);
  assert.equal(d.record?.activationTime, T);
});

test("HALTING, before T - 15m: hold", () => {
  const d = decide(chain({ state: HaltState.HALTING, haltStartedAt: T - 7000 }), signal(), record(), T - 3600, W);
  assert.deepEqual(d.steps, []);
});

test("HALTING, at T - 15m: pause the oracle through the multisig, then sync", () => {
  const d = decide(chain({ state: HaltState.HALTING, haltStartedAt: T - 7000 }), signal(), record(), T - 900, W);
  assert.deepEqual(d.steps, ["pauseOracle", "sync"]);
});

test("HALTED before T + 15m: hold, even though the multiplier already switched at T", () => {
  const d = decide(
    chain({ state: HaltState.HALTED, oraclePaused: true, haltStartedAt: T - 7000 }),
    none({ currentMultiplier: 1.0017 }),
    record(),
    T + 600,
    W,
  );
  assert.deepEqual(d.steps, []);
});

test("HALTED after T + 15m with the new multiplier in place: resume the oracle, then sync", () => {
  const d = decide(
    chain({ state: HaltState.HALTED, oraclePaused: true, haltStartedAt: T - 7000 }),
    none({ currentMultiplier: 1.0017 }),
    record(),
    T + 900,
    W,
  );
  assert.deepEqual(d.steps, ["resumeOracle", "sync"]);
  assert.equal(d.record?.resumedAt, T + 900);
});

test("RESUMING inside the cooldown: hold", () => {
  const d = decide(
    chain({ state: HaltState.RESUMING, priceUpdatedAt: T + 910, blockTs: T + 1000 }),
    none({ currentMultiplier: 1.0017 }),
    record({ resumedAt: T + 900 }),
    T + 1000,
    W,
  );
  assert.deepEqual(d.steps, []);
});

test("RESUMING past the cooldown, fresh post-action price, solvent: completeResume", () => {
  const d = decide(
    chain({ state: HaltState.RESUMING, priceUpdatedAt: T + 910, blockTs: T + 2800 }),
    none({ currentMultiplier: 1.0017 }),
    record({ resumedAt: T + 900 }),
    T + 2800,
    W,
  );
  assert.deepEqual(d.steps, ["completeResume"]);
});

test("OPEN again after the cycle: the record is dropped", () => {
  const d = decide(chain(), none({ currentMultiplier: 1.0017 }), record({ resumedAt: T + 900 }), T + 3000, W);
  assert.deepEqual(d.steps, []);
  assert.equal(d.record, null);
  assert.ok(d.notes.some((n) => n.key.startsWith("done:")));
});

// --- the cases that make it safe --------------------------------------------

test("first seen inside the window (the real SPY 9-minute case): straight to pause + sync from OPEN", () => {
  const d = decide(chain(), signal(), null, T - 540, W);
  assert.deepEqual(d.steps, ["pauseOracle", "sync"]);
});

test("oracle already paused: only sync, never a second pause", () => {
  const d = decide(chain({ state: HaltState.HALTING, oraclePaused: true }), signal(), record(), T - 600, W);
  assert.deepEqual(d.steps, ["sync"]);
});

test("new multiplier NOT in place after T + 15m: stay HALTED, never resume on a guess", () => {
  const d = decide(
    chain({ state: HaltState.HALTED, oraclePaused: true }),
    none({ currentMultiplier: 1.0009 }),
    record(),
    T + 3600,
    W,
  );
  assert.deepEqual(d.steps, []);
});

test("...and past STUCK_AFTER it raises a warning", () => {
  const d = decide(
    chain({ state: HaltState.HALTED, oraclePaused: true }),
    none({ currentMultiplier: 1.0009 }),
    record(),
    T + 7 * 3600,
    W,
  );
  assert.deepEqual(d.steps, []);
  assert.ok(d.notes.some((n) => n.key.startsWith("stuck:") && n.level === "warn"));
});

test("insolvent after the cooldown: hold in RESUMING and warn", () => {
  const d = decide(
    chain({ state: HaltState.RESUMING, solvent: false, priceUpdatedAt: T + 910, blockTs: T + 2800 }),
    none(),
    record({ resumedAt: T + 900 }),
    T + 2800,
    W,
  );
  assert.deepEqual(d.steps, []);
  assert.ok(d.notes.some((n) => n.key.startsWith("insolvent:")));
});

test("price not refreshed since before T: hold in RESUMING", () => {
  const d = decide(
    chain({ state: HaltState.RESUMING, priceUpdatedAt: T - 100, blockTs: T + 2800 }),
    none(),
    record({ resumedAt: T + 900 }),
    T + 2800,
    W,
  );
  assert.deepEqual(d.steps, []);
});

test("a halt the keeper didn't start (someone ran halt.sh) is left alone", () => {
  const d = decide(
    chain({ state: HaltState.HALTED, oraclePaused: true, haltStartedAt: T - 50_000 }),
    none(),
    null,
    T,
    W,
  );
  assert.deepEqual(d.steps, []);
  assert.ok(d.notes.some((n) => n.key.startsWith("unexplained:")));
});

test("record lost on restart, but the halt lines up with the scheduled action: adopted", () => {
  const d = decide(
    chain({ state: HaltState.HALTING, haltStartedAt: T - 7100 }),
    signal(),
    null,
    T - 800,
    W,
  );
  assert.equal(d.record?.adopted, true);
  assert.deepEqual(d.steps, ["pauseOracle", "sync"]);
});

test("action withdrawn while HALTING: go through pause so the market can reopen", () => {
  const d = decide(chain({ state: HaltState.HALTING, haltStartedAt: T - 7000 }), none(), record(), T - 3600, W);
  assert.equal(d.record?.cancelled, true);
  assert.deepEqual(d.steps, ["pauseOracle", "sync"]);
});

test("...then from HALTED a cancelled action resumes straight away, without waiting for T", () => {
  const d = decide(
    chain({ state: HaltState.HALTED, oraclePaused: true }),
    none(),
    record({ cancelled: true }),
    T - 3500,
    W,
  );
  assert.deepEqual(d.steps, ["resumeOracle", "sync"]);
});

test("a source being down is NOT read as a cancellation", () => {
  const d = decide(
    chain({ state: HaltState.HALTING }),
    none({ allSourcesOk: false }),
    record(),
    T - 3600,
    W,
  );
  assert.notEqual(d.record?.cancelled, true);
  assert.deepEqual(d.steps, []);
});

test("rescheduled earlier: the halt follows the new time", () => {
  const d = decide(
    chain({ state: HaltState.HALTING }),
    signal({ pending: { activationTime: T - 1800, newMultiplier: 1.0017, reason: "Dividend", source: "onchain" } }),
    record(),
    T - 2600,
    W,
  );
  assert.equal(d.record?.activationTime, T - 1800);
  assert.deepEqual(d.steps, ["pauseOracle", "sync"]);
});

test("moved out beyond the lead window: treated as cancelled, will re-halt later", () => {
  const d = decide(
    chain({ state: HaltState.HALTING }),
    signal({ pending: { activationTime: T + 3 * 86_400, newMultiplier: 1.0017, reason: "Dividend", source: "onchain" } }),
    record(),
    T - 3600,
    W,
  );
  assert.equal(d.record?.cancelled, true);
});

test("an action that passed while the market stayed OPEN is reported as missed", () => {
  const d = decide(chain(), none(), record(), T + 1800, W);
  assert.deepEqual(d.steps, []);
  assert.ok(d.notes.some((n) => n.key.startsWith("missed:")));
});

test("SETTLING is never touched", () => {
  const d = decide(chain({ state: HaltState.SETTLING, oraclePaused: true }), none(), record(), T + 8 * 86_400, W);
  assert.deepEqual(d.steps, []);
});

test("a simulated action resumes without a real multiplier change", () => {
  const d = decide(
    chain({ state: HaltState.HALTED, oraclePaused: true }),
    none({ currentMultiplier: 1.0009 }),
    record({ source: "simulated", newMultiplier: null }),
    T + 900,
    W,
  );
  assert.deepEqual(d.steps, ["resumeOracle", "sync"]);
});

// --- price push (port of push_prices.py) -------------------------------------

test("stepToward caps a move at the oracle's deviation limit", () => {
  assert.deepEqual(stepToward(100n * WAD, 110n * WAD, 2000n), { push: 110n * WAD, aligned: true });
  assert.deepEqual(stepToward(100n * WAD, 200n * WAD, 2000n), { push: 120n * WAD, aligned: false });
  assert.deepEqual(stepToward(100n * WAD, 10n * WAD, 2000n), { push: 80n * WAD, aligned: false });
});

test("planPush: paused skipped, unchanged-but-old refreshed, unchanged-and-recent left alone", () => {
  const base = { current: 100n * WAD, target: 100n * WAD, maxBps: 2000n, chainNow: 100_000, refreshAfterSec: 21_600 };
  assert.equal(planPush({ ...base, updatedAt: 0, paused: true }).push, null);
  assert.equal(planPush({ ...base, updatedAt: 100_000 - 22_000, paused: false }).push, 100n * WAD);
  assert.equal(planPush({ ...base, updatedAt: 100_000 - 60, paused: false }).push, null);
});
