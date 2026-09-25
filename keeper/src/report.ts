import type { SourceName, WatchEvent } from "./types";

// Answers the Phase 0 question from the event log: for each corporate action,
// how long before activation did each source first show it?

export type SourceSighting = {
  firstSeenAt: number;
  leadSec: number;
  /// Already pending when the watcher started, so leadSec is a lower bound.
  lowerBound: boolean;
  clearedAfterSec: number | null;
  multiplierApplied: boolean | null;
};

export type ActionReport = {
  ticker: string;
  activationTime: number;
  reason: string | null;
  newMultiplier: number;
  status: "pending" | "activated" | "cancelled" | "rescheduled";
  onchain: SourceSighting | null;
  api: SourceSighting | null;
};

export function buildReport(events: WatchEvent[]): ActionReport[] {
  const actions = new Map<string, ActionReport>();
  const keyOf = (ticker: string, activationTime: number) => `${ticker}@${activationTime}`;

  for (const e of events) {
    const source = e.source as SourceName | undefined;
    if (!source) continue;
    const activationTime = e.activationTime as number | undefined;
    if (activationTime === undefined) continue;
    const key = keyOf(e.ticker, activationTime);

    if (e.type === "scheduled" || e.type === "rescheduled") {
      if (e.type === "rescheduled") {
        const old = actions.get(keyOf(e.ticker, e.previousActivationTime as number));
        if (old && old.status === "pending") old.status = "rescheduled";
      }
      const a =
        actions.get(key) ??
        ({
          ticker: e.ticker,
          activationTime,
          reason: null,
          newMultiplier: e.newMultiplier as number,
          status: "pending",
          onchain: null,
          api: null,
        } satisfies ActionReport);
      a.reason ??= (e.reason as string | null) ?? null;
      if (!a[source]) {
        a[source] = {
          firstSeenAt: e.at,
          leadSec: e.leadSec as number,
          lowerBound: e.seenOnStartup as boolean,
          clearedAfterSec: null,
          multiplierApplied: null,
        };
      }
      actions.set(key, a);
    } else if (e.type === "activated" || e.type === "cancelled") {
      const a = actions.get(key);
      if (!a) continue;
      a.status = e.type;
      const s = a[source];
      if (s && e.type === "activated") {
        s.clearedAfterSec = e.clearedAfterSec as number;
        s.multiplierApplied = e.multiplierApplied as boolean;
      }
    }
  }

  return [...actions.values()].sort((x, y) => y.activationTime - x.activationTime);
}

const hours = (sec: number) => `${(sec / 3600).toFixed(1)}h`;
const iso = (ts: number) => new Date(ts * 1000).toISOString().replace(".000Z", "Z");

export function formatReport(rows: ActionReport[]): string {
  if (rows.length === 0) return "No corporate actions observed yet.";
  const lead = (s: SourceSighting | null) => (s ? `${s.lowerBound ? "≥" : ""}${hours(s.leadSec)}` : "—");
  const header = ["ticker", "reason", "activation (UTC)", "status", "on-chain lead", "API lead"];
  const lines = rows.map((r) => [
    r.ticker,
    r.reason ?? "?",
    iso(r.activationTime),
    r.status,
    lead(r.onchain),
    lead(r.api),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)));
  const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [fmt(header), ...lines.map(fmt), "", "≥ = already pending when the watcher started; a lower bound."].join(
    "\n",
  );
}
