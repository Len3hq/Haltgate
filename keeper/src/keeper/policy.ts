import { sameMultiplier } from "../observe";
import { HaltState, type MarketChain } from "../testnet/markets";

// Pure. Given what the chain says, what the corporate-action sources say, and
// the keeper's record of halts it started, return the transactions to send.
// Called every tick with fresh inputs, so it only ever answers "what next from
// here": a failed step, a restart or a double tick all converge on the same
// answer next time.
//
// Timeline around an activation time T (defaults):
//
//   T - 2h           T - 15m          T           T + 15m          + 30m
//   │  HALTING       │  HALTED        │           │  RESUMING      │  OPEN
//   beginHalting     pauseOracle      multiplier   resumeOracle     completeResume
//                    + sync           switches     + sync           (if solvent and
//                                     on its own                    the price is fresh)

export type ActionInfo = {
  activationTime: number;
  newMultiplier: number | null;
  reason: string | null;
  source: "onchain" | "api" | "simulated";
};

export type Signal = {
  /// The scheduled action, if any source shows one. With both, the earlier.
  pending: ActionInfo | null;
  /// Live multiplier from the best available source (on-chain first).
  currentMultiplier: number | null;
  /// Every source for this ticker answered on its last poll. Only then can
  /// "nothing pending" be read as cancelled rather than unknown.
  allSourcesOk: boolean;
};

/// A halt the keeper started. The one thing it remembers, because after T the
/// action vanishes from both sources and a halt it can't explain is one it
/// must not lift.
export type HaltRecord = ActionInfo & {
  startedAt: number;
  /// Rebuilt from on-chain haltStartedAt after the record was lost.
  adopted?: boolean;
  /// Withdrawn, or moved further out than the lead window, before T.
  cancelled?: boolean;
  resumedAt?: number;
};

export type Step = "beginHalting" | "pauseOracle" | "sync" | "resumeOracle" | "completeResume";

export type Note = { key: string; level: "info" | "warn"; text: string };

export type Windows = {
  haltingLeadSec: number;
  haltBufferSec: number;
  resumeCooldownSec: number;
  stuckAfterSec: number;
  adoptSlackSec: number;
};

export type Decision = { steps: Step[]; record: HaltRecord | null; notes: Note[] };

const iso = (ts: number) => new Date(ts * 1000).toISOString().replace(".000Z", "Z");

export function decide(
  chain: MarketChain,
  signal: Signal,
  record: HaltRecord | null,
  now: number,
  w: Windows,
): Decision {
  const notes: Note[] = [];
  const p = signal.pending;
  let rec: HaltRecord | null = record ? { ...record } : null;

  // 1. Record lost (restart without the volume) but the halt lines up with a
  // scheduled action: adopt it rather than strand the market.
  if (!rec && chain.state !== HaltState.OPEN && p) {
    const T = p.activationTime;
    if (chain.haltStartedAt >= T - w.haltingLeadSec - w.adoptSlackSec && chain.haltStartedAt <= T + w.haltBufferSec) {
      rec = { ...p, startedAt: chain.haltStartedAt, adopted: true };
      notes.push({
        key: `adopt:${T}`,
        level: "info",
        text: `halt started ${iso(chain.haltStartedAt)} matches the action due ${iso(T)}; adopting it`,
      });
    }
  }

  // 2. A new action has come inside the lead window.
  if (!rec && chain.state === HaltState.OPEN && p && now >= p.activationTime - w.haltingLeadSec) {
    rec = { ...p, startedAt: now };
  }

  // 3. The action changed before it activated.
  if (rec && !rec.cancelled && !rec.resumedAt && now < rec.activationTime) {
    const changed =
      p &&
      (p.activationTime !== rec.activationTime ||
        (p.newMultiplier !== null && rec.newMultiplier !== null && !sameMultiplier(p.newMultiplier, rec.newMultiplier)));
    if (p && changed) {
      if (p.activationTime - now > w.haltingLeadSec) {
        rec.cancelled = true;
        notes.push({
          key: `moved:${rec.activationTime}:${p.activationTime}`,
          level: "warn",
          text: `action moved from ${iso(rec.activationTime)} to ${iso(p.activationTime)}, outside the lead window; reopening and halting again later`,
        });
      } else {
        notes.push({
          key: `resched:${rec.activationTime}:${p.activationTime}`,
          level: "info",
          text: `action rescheduled from ${iso(rec.activationTime)} to ${iso(p.activationTime)}`,
        });
        rec = { ...rec, activationTime: p.activationTime, newMultiplier: p.newMultiplier, reason: p.reason ?? rec.reason };
      }
    } else if (!p && signal.allSourcesOk) {
      rec.cancelled = true;
      notes.push({
        key: `cancel:${rec.activationTime}`,
        level: "warn",
        text: `action due ${iso(rec.activationTime)} disappeared before activating; treating it as cancelled`,
      });
    }
  }

  if (!rec) {
    if (chain.state !== HaltState.OPEN) {
      notes.push({
        key: `unexplained:${chain.state}:${chain.haltStartedAt}`,
        level: "warn",
        text: `market is ${HaltState[chain.state]} since ${iso(chain.haltStartedAt)} and no scheduled action explains it. Not the keeper's halt, leaving it alone`,
      });
    }
    return { steps: [], record: null, notes };
  }

  const T = rec.activationTime;
  const inWindow = now >= T - w.haltBufferSec;
  const pastT = now >= T + w.haltBufferSec;
  const settled =
    rec.source === "simulated" ||
    rec.newMultiplier === null ||
    (signal.currentMultiplier !== null && sameMultiplier(signal.currentMultiplier, rec.newMultiplier));
  const halt = (): Step[] => (chain.oraclePaused ? ["sync"] : ["pauseOracle", "sync"]);
  let steps: Step[] = [];

  switch (chain.state) {
    case HaltState.OPEN:
      if (rec.resumedAt) {
        notes.push({ key: `done:${T}`, level: "info", text: `halt cycle for the action at ${iso(T)} complete, market OPEN` });
        return { steps: [], record: null, notes };
      }
      if (rec.cancelled) return { steps: [], record: null, notes };
      if (pastT) {
        notes.push({
          key: `missed:${T}`,
          level: "warn",
          text: `action at ${iso(T)} passed without the market being halted`,
        });
        return { steps: [], record: null, notes };
      }
      // Straight to HALTED when first seen inside the window. Observed for
      // real: SPY on 2026-06-18 was scheduled 9 minutes before activation.
      steps = inWindow ? halt() : ["beginHalting"];
      break;

    case HaltState.HALTING:
      // Cancelled goes through HALTED too: the contract's only way from
      // HALTING back to OPEN runs through pause -> resume -> completeResume.
      if (rec.cancelled || inWindow) steps = halt();
      break;

    case HaltState.HALTED:
      if (!chain.oraclePaused) {
        steps = ["sync"]; // oracle resumed by someone else; sync moves on to RESUMING
      } else if (rec.cancelled || (pastT && settled)) {
        steps = ["resumeOracle", "sync"];
        rec.resumedAt = now;
      } else if (pastT && now >= T + w.stuckAfterSec) {
        notes.push({
          key: `stuck:${T}`,
          level: "warn",
          text: `still HALTED ${Math.round((now - T) / 3600)}h after ${iso(T)}: new multiplier ${rec.newMultiplier} not in place (live ${signal.currentMultiplier})`,
        });
      }
      break;

    case HaltState.RESUMING: {
      rec.resumedAt ??= now; // adopted mid-resume: start the cooldown now, conservatively
      if (now - rec.resumedAt < w.resumeCooldownSec) break;
      const postAction = rec.cancelled || chain.priceUpdatedAt >= T;
      const fresh = postAction && chain.blockTs - chain.priceUpdatedAt <= chain.maxOracleStaleness;
      if (!fresh) {
        notes.push({ key: `stale:${T}`, level: "warn", text: `holding in RESUMING: no fresh post-action price yet` });
      } else if (!chain.solvent) {
        notes.push({
          key: `insolvent:${T}`,
          level: "warn",
          text: `holding in RESUMING: isSystemSolvent() is false, total debt exceeds collateral value`,
        });
      } else {
        steps = ["completeResume"];
      }
      break;
    }

    case HaltState.SETTLING:
      notes.push({
        key: `settling:${chain.haltStartedAt}`,
        level: "warn",
        text: `market is SETTLING (halt outlasted settlementDelay). The keeper does not touch this state`,
      });
      break;
  }

  return { steps, record: rec, notes };
}
