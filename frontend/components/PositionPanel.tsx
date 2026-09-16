"use client";

import { useAccount } from "wagmi";
import { useReadMarketPositions, useReadMarketHealthFactor } from "@/lib/generated";
import { CONTRACTS, USDG_DECIMALS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";

const MAX_UINT256 = (1n << 256n) - 1n;

function healthFactorDisplay(hf: bigint | undefined): { label: string; color: string } {
  if (hf === undefined) return { label: "--", color: "text-[var(--color-text-muted)]" };
  if (hf === MAX_UINT256) return { label: "No debt", color: "text-[var(--color-text-muted)]" };
  const value = Number(hf) / 1e18;
  if (value >= 1.5) return { label: value.toFixed(2), color: "text-[var(--color-success)]" };
  if (value >= 1.0) return { label: value.toFixed(2), color: "text-[var(--color-warning)]" };
  return { label: value.toFixed(2), color: "text-[var(--color-error)]" };
}

export function PositionPanel() {
  const { address, isConnected } = useAccount();

  const { data: position } = useReadMarketPositions({
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
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center text-sm text-[var(--color-text-muted)]">
        Connect your wallet to view your position.
      </div>
    );
  }

  const collateral = position?.[0];
  const debt = position?.[1];
  const hf = healthFactorDisplay(healthFactor);

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Your Position</p>
      <div className="mt-3 grid grid-cols-3 gap-4">
        <div>
          <p className="text-lg font-semibold text-[var(--color-text)]">{formatAmount(collateral, WNVDAX_DECIMALS)}</p>
          <p className="text-xs text-[var(--color-text-muted)]">Supplied (wNVDAx)</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-[var(--color-text)]">{formatAmount(debt, USDG_DECIMALS)}</p>
          <p className="text-xs text-[var(--color-text-muted)]">Borrowed (USDG)</p>
        </div>
        <div>
          <p className={`text-lg font-semibold ${hf.color}`}>{hf.label}</p>
          <p className="text-xs text-[var(--color-text-muted)]">Health Factor</p>
        </div>
      </div>
    </div>
  );
}
