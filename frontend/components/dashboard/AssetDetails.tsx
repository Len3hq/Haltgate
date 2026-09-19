"use client";

import { SHARED, type MarketConfig } from "@/lib/contracts";
import { xLayerTestnet } from "@/lib/chains";

const EXPLORER = xLayerTestnet.blockExplorers.default.url;

function AddressRow({ label, address, note }: { label: string; address: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-[var(--color-text-muted)]">
        {label}
        {note && <span className="ml-1.5 text-[10px] text-[var(--color-text-faint)]">{note}</span>}
      </span>
      <a
        href={`${EXPLORER}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[11px] text-[var(--color-accent-blue)] hover:underline"
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </a>
    </div>
  );
}

/// Kamino uses this slot for websites and audits. On testnet it does something
/// more useful: every claim on this page is one click from being verified
/// on-chain.
export function AssetDetails({ config }: { config: MarketConfig }) {
  return (
    <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Contracts</p>
      <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
        This market&apos;s isolated stack, plus the pieces shared across all markets.
      </p>

      <div className="mt-3 divide-y divide-[var(--color-border-subtle)]">
        <AddressRow label="Market" address={config.market} />
        <AddressRow label="Lender vault" address={config.lenderVault} note="ERC-4626" />
        <AddressRow label="Halt controller" address={config.haltController} />
        <AddressRow label="Oracle" address={config.oracle} note="mock pauseOracle" />
        <AddressRow label="Collateral" address={config.collateral} note={config.symbol} />
        <AddressRow label="Swap module" address={config.swapModule} />
        <AddressRow label="Faucet" address={config.faucet} />
      </div>

      <p className="mt-3 text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Shared</p>
      <div className="divide-y divide-[var(--color-border-subtle)]">
        <AddressRow label="USDG" address={SHARED.usdg} note="real testnet USDG" />
        <AddressRow label="Interest rate model" address={SHARED.interestRateModel} />
        <AddressRow label="Leverage zap" address={SHARED.leverageZap} />
        <AddressRow label="Timelock" address={SHARED.timelock} />
        <AddressRow label="Multisig" address={SHARED.multisig} />
      </div>
    </div>
  );
}
