"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { xLayerTestnet } from "@/lib/chains";
import { getErrorMessage } from "@/lib/errors";

// All contract reads/writes are configured for X Layer testnet only -- if
// the wallet is on a different chain, wagmi has no client for it, so every
// panel below would just silently show no data with no indication why.
// Gate the panels behind an explicit network check instead.
export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();

  const wrongNetwork = isConnected && chainId !== xLayerTestnet.id;

  if (!wrongNetwork) return <>{children}</>;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-6 text-center">
      <p className="text-sm font-semibold text-[var(--color-warning)]">Wrong network</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        HaltGate runs on X Layer Testnet. Switch your wallet&apos;s network to continue.
      </p>
      <button
        onClick={() => switchChain({ chainId: xLayerTestnet.id })}
        disabled={isPending}
        className="mt-3 rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
      >
        {isPending ? "Switching..." : "Switch to X Layer Testnet"}
      </button>
      {error && <p className="mt-2 text-xs text-[var(--color-error)]">{getErrorMessage(error)}</p>}
    </div>
  );
}
