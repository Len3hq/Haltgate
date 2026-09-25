import assert from "node:assert/strict";
import { test } from "node:test";
import { needsSync } from "../src/tools/sync-watchdog";
import { HaltState } from "../src/testnet/markets";

// Every (state, oracle) pair against HaltController.sync()'s own rules:
//   paused   -> HALTED from anything except HALTED (no-op) and SETTLING (kept)
//   unpaused -> RESUMING from HALTED or SETTLING, otherwise no-op

test("paused oracle: every state but HALTED and SETTLING has drifted", () => {
  assert.equal(needsSync({ state: HaltState.OPEN, oraclePaused: true }), true);
  assert.equal(needsSync({ state: HaltState.HALTING, oraclePaused: true }), true);
  assert.equal(needsSync({ state: HaltState.RESUMING, oraclePaused: true }), true);
  assert.equal(needsSync({ state: HaltState.HALTED, oraclePaused: true }), false);
  assert.equal(needsSync({ state: HaltState.SETTLING, oraclePaused: true }), false);
});

test("live oracle: only HALTED and SETTLING have drifted", () => {
  assert.equal(needsSync({ state: HaltState.HALTED, oraclePaused: false }), true);
  assert.equal(needsSync({ state: HaltState.SETTLING, oraclePaused: false }), true);
  assert.equal(needsSync({ state: HaltState.OPEN, oraclePaused: false }), false);
  // HALTING is the keeper's advance warning, not something sync() undoes.
  assert.equal(needsSync({ state: HaltState.HALTING, oraclePaused: false }), false);
  assert.equal(needsSync({ state: HaltState.RESUMING, oraclePaused: false }), false);
});
