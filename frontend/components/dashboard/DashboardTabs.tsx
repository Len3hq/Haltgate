"use client";

import { useState } from "react";
import { PositionPanel } from "./PositionPanel";
import { ActionPanel } from "./ActionPanel";
import { EarnPanel } from "./EarnPanel";
import { LiquidatePanel } from "./LiquidatePanel";

type Persona = "borrow" | "earn" | "liquidate";

const PERSONAS: { key: Persona; label: string; hint: string }[] = [
  { key: "borrow", label: "Borrow", hint: "Supply collateral, borrow USDG" },
  { key: "earn", label: "Earn", hint: "Deposit USDG, earn interest" },
  { key: "liquidate", label: "Liquidate", hint: "Repay an unsafe position for a discount" },
];

/// Previously every flow (borrow, earn, liquidate) rendered as permanently
/// stacked cards, all visible at once regardless of which one a given
/// visitor actually came to use -- the direct cause of "too many numbers
/// everywhere." Only one borrower/lender/liquidator persona's numbers show
/// at a time now; switching tabs is one click, nothing is deleted.
export function DashboardTabs() {
  const [persona, setPersona] = useState<Persona>("borrow");

  return (
    <div>
      <div className="flex gap-1 rounded-[var(--radius-pill)] bg-[var(--color-bg-card)] p-1">
        {PERSONAS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPersona(p.key)}
            className={`flex-1 rounded-[var(--radius-pill)] px-3 py-2.5 text-sm font-medium transition-colors ${
              persona === p.key ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--color-text-faint)]">{PERSONAS.find((p) => p.key === persona)?.hint}</p>

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
