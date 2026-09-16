"use client";

import { useEffect, useRef, useState } from "react";
import {
  useReadIPausableOracleLatestPrice,
  useReadMarketTotalCollateral,
  useReadMarketTotalDebt,
  useReadHaltControllerState,
} from "@/lib/generated";
import { CONTRACTS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { formatAmount, formatPrice } from "@/lib/format";

const STATE_LABEL = ["Open", "Halting", "Halted", "Resuming"] as const;

// Real numbers from the live testnet deployment, not marketing filler --
// this is the actual current state of the Market and HaltController.
export function LiveMarketStats() {
  const { data: priceData } = useReadIPausableOracleLatestPrice({ address: CONTRACTS.oracle, query: { refetchInterval: 10_000 } });
  const { data: totalCollateral } = useReadMarketTotalCollateral({ address: CONTRACTS.market, query: { refetchInterval: 10_000 } });
  const { data: totalDebt } = useReadMarketTotalDebt({ address: CONTRACTS.market, query: { refetchInterval: 10_000 } });
  const { data: haltState } = useReadHaltControllerState({ address: CONTRACTS.haltController, query: { refetchInterval: 10_000 } });

  const price = priceData?.[0];
  const stateLabel = haltState !== undefined ? STATE_LABEL[haltState] : undefined;

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-4">
      <Stat label="wNVDAx price" value={price !== undefined ? `$${formatPrice(price)}` : undefined} />
      <Stat label="Total supplied" value={totalCollateral !== undefined ? `${formatAmount(totalCollateral, WNVDAX_DECIMALS)} wNVDAx` : undefined} />
      <Stat label="Chain" value="X Layer Testnet" static />
      <Stat label="Market status" value={stateLabel} accentSuccess={stateLabel === "Open"} />
    </dl>
  );
}

function Stat({
  label,
  value,
  static: isStatic,
  accentSuccess,
}: {
  label: string;
  value: string | undefined;
  static?: boolean;
  accentSuccess?: boolean;
}) {
  const displayRef = useRef<HTMLParagraphElement>(null);
  const [display, setDisplay] = useState<string | undefined>(isStatic ? value : undefined);

  useEffect(() => {
    if (isStatic || value === undefined) return;
    setDisplay(value);
    if (displayRef.current) {
      displayRef.current.animate(
        [
          { opacity: 0.3, transform: "translateY(2px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 300, easing: "ease-out" }
      );
    }
  }, [value, isStatic]);

  return (
    <div className="bg-[var(--color-bg)] px-5 py-4">
      <dt className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">{label}</dt>
      <dd
        ref={displayRef}
        className={`mt-1 font-[family-name:var(--font-display)] text-lg font-semibold ${
          accentSuccess ? "text-[var(--color-success)]" : "text-[var(--color-text)]"
        }`}
      >
        {display ?? <span className="inline-block h-5 w-16 animate-pulse rounded bg-[var(--color-border-subtle)]" />}
      </dd>
    </div>
  );
}
