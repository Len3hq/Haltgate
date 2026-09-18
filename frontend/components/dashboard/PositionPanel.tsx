"use client";

import { useAccount } from "wagmi";
import { useReadMarketGetPosition, useReadMarketHealthFactor } from "@/lib/generated";
import { USDG_DECIMALS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
import { HealthGauge } from "./HealthGauge";
import { useMarketContracts } from "@/lib/market-context";

export function PositionPanel() {
  const CONTRACTS = useMarketContracts();
  const { address, isConnected } = useAccount();

  const { data: position } = useReadMarketGetPosition({
    address: CONTRACTS.market,
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });
  const { data: healthFactor } = useReadMarketHealthFactor({
    address: CONTRACTS.market,
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });

  if (!isConnected) {
    return (
      <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center text-sm text-[var(--color-text-muted)]">
        Connect your wallet to view your position.
      </div>
    );
  }

  const collateral = position?.[0];
  const debt = position?.[1];

  return (
    <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Your Position</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-6">
        <div className="flex gap-8">
          <div>
            <p className="text-2xl font-semibold text-[var(--color-text)]">{formatAmount(collateral, WNVDAX_DECIMALS)}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Supplied (wNVDAx)</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-[var(--color-text)]">{formatAmount(debt, USDG_DECIMALS)}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Borrowed (USDG)</p>
          </div>
        </div>
        <HealthGauge value={healthFactor} />
      </div>
    </div>
  );
}
