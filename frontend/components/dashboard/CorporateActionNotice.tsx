"use client";

import { useQuery } from "@tanstack/react-query";
import { useMarketKey } from "@/lib/market-context";
import { useNow } from "@/lib/use-now";

// The keeper (keeper/ in this repo, running on Railway) watches the issuer's
// corporate-action schedule and halts markets around it. Its public /schedule
// endpoint says what is coming for each market, so the banner can warn before
// a halt instead of only explaining one after it starts.
//
// Unset NEXT_PUBLIC_KEEPER_URL and this renders nothing, as it does if the
// keeper can't be reached: on-chain state stays the banner's source of truth,
// this is only the forecast. Inlined at build time, so changing it on Vercel
// needs a redeploy.
const KEEPER_URL = process.env.NEXT_PUBLIC_KEEPER_URL;

type ScheduleAction = {
  reason: string | null;
  source: "onchain" | "api" | "simulated";
  activationTime: number;
  haltingAt: number;
  haltedAt: number;
  resumeFrom: number;
  reopenFrom: number;
  cancelled: boolean;
};

type ScheduleEntry = {
  market: string;
  state: string | null;
  action: ScheduleAction | null;
};

function when(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function describe(entry: ScheduleEntry, now: number): string | null {
  const a = entry.action;
  if (!a) return null;
  const what = a.reason ? a.reason.toLowerCase() : "corporate action";

  if (a.cancelled) return `The scheduled ${what} was withdrawn before it took effect; the market is reopening.`;

  switch (entry.state) {
    case "OPEN":
      if (now >= a.activationTime) return null;
      return `Upcoming ${what}, effective ${when(a.activationTime)}. New borrowing pauses from ${when(a.haltingAt)} and the market halts at ${when(a.haltedAt)}.`;
    case "HALTING":
    case "HALTED":
      return `For a ${what} effective ${when(a.activationTime)}. Expected to reopen from about ${when(a.reopenFrom)}, once the new share multiplier and a fresh price check out.`;
    case "RESUMING":
      return `The ${what} has taken effect. Liquidations reopen from about ${when(a.reopenFrom)}, once the post-event price and system solvency are confirmed.`;
    default:
      return null;
  }
}

export function CorporateActionNotice() {
  const marketKey = useMarketKey();
  const now = useNow();

  const { data } = useQuery({
    queryKey: ["keeper-schedule"],
    enabled: !!KEEPER_URL,
    refetchInterval: 60_000,
    retry: false,
    queryFn: async (): Promise<ScheduleEntry[]> => {
      const res = await fetch(`${KEEPER_URL!.replace(/\/$/, "")}/schedule`);
      if (!res.ok) throw new Error(`keeper schedule: HTTP ${res.status}`);
      return ((await res.json()) as { markets: ScheduleEntry[] }).markets;
    },
  });

  const entry = data?.find((m) => m.market === marketKey);
  const message = entry ? describe(entry, now) : null;
  if (!message) return null;

  return (
    <p className="mt-2 text-xs text-[var(--color-text-faint)]">
      {message}
      {entry?.action?.source === "simulated" && " (rehearsal, not a real corporate action)"}
    </p>
  );
}
