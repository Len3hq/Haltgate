export type SourceName = "onchain" | "api";

/// One source's view of one ticker at one moment. Timestamps are unix seconds.
export type Reading =
  | {
      ok: true;
      /// A multiplier change is scheduled and has not activated yet.
      pending: boolean;
      activationTime: number | null;
      newMultiplier: number | null;
      currentMultiplier: number;
      /// "Dividend", "Split", ... The API has it; the chain does not.
      reason: string | null;
    }
  | { ok: false; error: string };

export type Pending = {
  activationTime: number;
  newMultiplier: number;
  reason: string | null;
  firstSeenAt: number;
  /// True when the watcher found this already pending on its very first look,
  /// so firstSeenAt is when we started watching, not when it was announced.
  /// Its lead time is a lower bound only.
  seenOnStartup: boolean;
};

export type SourceState = {
  pending: Pending | null;
  down: { since: number; error: string } | null;
  lastOkAt: number | null;
  lastReading: Reading | null;
};

export type TickerState = {
  onchain?: SourceState;
  api?: SourceState;
  disagreement: string | null;
};

export type State = {
  version: 1;
  startedAt: number;
  lastTickAt: number | null;
  tickers: Record<string, TickerState>;
};

export type WatchEvent = {
  at: number;
  ticker: string;
  source?: SourceName;
  type:
    | "scheduled"
    | "rescheduled"
    | "cancelled"
    | "activated"
    | "source-down"
    | "source-recovered"
    | "disagreement"
    | "disagreement-resolved";
  [detail: string]: unknown;
};
