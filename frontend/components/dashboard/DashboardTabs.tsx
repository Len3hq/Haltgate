"use client";

import { useState } from "react";
import { PositionPanel } from "./PositionPanel";
import { ActionPanel } from "./ActionPanel";
import { EarnPanel } from "./EarnPanel";
import { LiquidatePanel } from "./LiquidatePanel";
import Link from "next/link";
import { useMarketKey } from "@/lib/market-context";

type Persona = "borrow" | "earn" | "liquidate";

const PERSONAS: { key: Persona; label: string; hint: string }[] = [
  { key: "borrow", label: "Borrow", hint: "Supply collateral, borrow USDG at a floating rate" },
  { key: "earn", label: "Earn", hint: "Deposit USDG, earn interest" },
  { key: "liquidate", label: "Liquidate", hint: "Repay an unsafe position for a discount" },
];

/// Three views of one variable-rate position, so they stay tabs. Fixed Term
/// and Multiply are separate products with their own risk models, and live at
/// their own routes rather than behind a tab with no URL.
export function DashboardTabs() {
  const [persona, setPersona] = useState<Persona>("borrow");
  const marketKey = useMarketKey();

  return (
    <div>
      <div className="flex gap-1 rounded-[var(--radius-pill)] bg-[var(--color-bg-card)] p-1">
        {PERSONAS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPersona(p.key)}
            className={`flex-1 whitespace-nowrap rounded-[var(--radius-pill)] px-2 py-2.5 text-sm font-medium transition-colors ${
              persona === p.key ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--color-text-faint)]">{PERSONAS.find((p) => p.key === persona)?.hint}</p>

      <div className="mt-3 flex gap-2">
        <Link
          href={`/app/fixed/${marketKey}`}
          className="flex-1 rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2 text-center text-[11px] font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
        >
          Fixed Term, no liquidation →
        </Link>
        <Link
          href={`/app/multiply/${marketKey}`}
          className="flex-1 rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2 text-center text-[11px] font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
        >
          Multiply →
        </Link>
      </div>

      <div className="mt-4">
        {persona === "borrow" && (
          <div className="space-y-4">
            <PositionPanel />
            <ActionPanel />
          </div>
        )}
        {persona === "earn" && <EarnPanel />}
        {persona === "liquidate" && <LiquidatePanel />}
      </div>
    </div>
  );
}
