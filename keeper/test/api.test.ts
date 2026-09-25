import assert from "node:assert/strict";
import { test } from "node:test";
import { parseActivation, parseApiMultiplier } from "../src/sources/api";
import { buildReport } from "../src/report";

const NOW = 1_789_000_000;

test("the real idle response parses as not pending", () => {
  const r = parseApiMultiplier(
    { currentMultiplier: 1.001701196801074, newMultiplier: 0, activationDateTime: 0, reason: null },
    NOW,
  );
  assert.equal(r.ok && r.pending, false);
});

test("activationDateTime accepts ISO, seconds, milliseconds and numeric strings", () => {
  assert.equal(parseActivation("2026-09-10T00:30:00.000Z"), 1_789_000_200);
  assert.equal(parseActivation(1_789_000_200), 1_789_000_200);
  assert.equal(parseActivation(1_789_000_200_000), 1_789_000_200);
  assert.equal(parseActivation("1789000200"), 1_789_000_200);
  assert.equal(parseActivation(0), null);
  assert.equal(parseActivation(null), null);
});

test("an unrecognised activation format is an error, never an all-clear", () => {
  const r = parseApiMultiplier(
    { currentMultiplier: 1, newMultiplier: 1.01, activationDateTime: "next tuesday", reason: "Dividend" },
    NOW,
  );
  assert.equal(r.ok, false);
});

test("a future activation with a new multiplier is pending, with its reason", () => {
  const r = parseApiMultiplier(
    { currentMultiplier: 1.0009, newMultiplier: 1.0017, activationDateTime: "2026-09-10T00:30:00Z", reason: "Dividend" },
    NOW,
  );
  assert.ok(r.ok && r.pending);
  assert.equal(r.ok && r.reason, "Dividend");
});

test("a past activation is not pending even if the API still echoes it", () => {
  const r = parseApiMultiplier(
    { currentMultiplier: 1.0017, newMultiplier: 1.0017, activationDateTime: "2026-09-10T00:30:00Z", reason: "Dividend" },
    1_789_000_300,
  );
  assert.equal(r.ok && r.pending, false);
});

test("the report pairs each source's first sighting with its action", () => {
  const T = 1_789_000_200;
  const rows = buildReport([
    { at: T - 20_000, ticker: "NVDA", source: "api", type: "scheduled", activationTime: T, newMultiplier: 1.0017, reason: "Dividend", leadSec: 20_000, seenOnStartup: false },
    { at: T - 14_400, ticker: "NVDA", source: "onchain", type: "scheduled", activationTime: T, newMultiplier: 1.0017, reason: null, leadSec: 14_400, seenOnStartup: false },
    { at: T + 30, ticker: "NVDA", source: "onchain", type: "activated", activationTime: T, clearedAfterSec: 30, multiplierApplied: true },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "activated");
  assert.equal(rows[0].reason, "Dividend");
  assert.equal(rows[0].api!.leadSec, 20_000);
  assert.equal(rows[0].onchain!.leadSec, 14_400);
  assert.equal(rows[0].onchain!.multiplierApplied, true);
});
