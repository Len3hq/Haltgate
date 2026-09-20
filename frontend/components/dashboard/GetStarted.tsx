"use client";

import { useAccount, useBalance, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { erc20Abi } from "viem";
import {
  useReadWnvdAxFaucetHasClaimed,
  useReadWnvdAxFaucetClaimAmount,
  useWriteWnvdAxFaucetClaim,
} from "@/lib/generated";
import { WNVDAX_DECIMALS } from "@/lib/contracts";
import { useMarketContracts, useMarketConfig } from "@/lib/market-context";
import { formatAmount } from "@/lib/format";
import { TxStatus } from "@/components/dashboard/TxStatus";

/// A first-time visitor arrives with no gas, no collateral and no stablecoin,
/// and every action fails until all three are sorted. The faucets existed but
/// lived inside a collapsed panel nobody opens, so the first thing a stranger
/// met was a revert. This surfaces the three prerequisites, ticks them off as
/// they are met, and disappears once the wallet can actually transact.
export function GetStarted() {
  const C = useMarketContracts();
  const config = useMarketConfig();
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();

  const { data: gas } = useBalance({ address, query: { enabled: !!address, refetchInterval: 10_000 } });
  const { data: collateral } = useReadContract({
    address: C.wNVDAx,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });
  const { data: usdg } = useReadContract({
    address: C.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const { data: hasClaimed, refetch: refetchClaimed } = useReadWnvdAxFaucetHasClaimed({
    address: C.wNVDAxFaucet,
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });
  const { data: claimAmount } = useReadWnvdAxFaucetClaimAmount({ address: C.wNVDAxFaucet });

  const claim = useWriteWnvdAxFaucetClaim();
  const claimReceipt = useWaitForTransactionReceipt({ hash: claim.data });

  useEffect(() => {
    if (claimReceipt.isSuccess) {
      refetchClaimed();
      queryClient.invalidateQueries();
    }
  }, [claimReceipt.isSuccess, refetchClaimed, queryClient]);

  const hasGas = (gas?.value ?? 0n) > 0n;
  const hasCollateral = (collateral ?? 0n) > 0n;
  const hasUsdg = (usdg ?? 0n) > 0n;

  // Gas and collateral are what borrowing needs. USDG is only required to
  // lend or to cover interest, so it never blocks the panel from clearing.
  if (isConnected && hasGas && hasCollateral) return null;

  return (
    <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-accent)]">Start here</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
        {isConnected
          ? "Three things before anything will work. This panel disappears once you have them."
          : "Connect a wallet to begin. You will need three things, all free."}
      </p>

      <ol className="mt-3 space-y-2">
        <Step done={isConnected && hasGas} n={1} label="Testnet OKB for gas">
          <a
            href="https://web3.okx.com/xlayer/faucet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:underline"
          >
            X Layer faucet ↗
          </a>
        </Step>

        <Step done={isConnected && hasCollateral} n={2} label={`${config.symbol} to borrow against`}>
          {hasClaimed ? (
            <span className="text-[var(--color-text-faint)]">already claimed on this address</span>
          ) : (
            <button
              onClick={() => claim.writeContract({ address: C.wNVDAxFaucet, args: [] })}
              disabled={!isConnected || !hasGas || claim.isPending || claimReceipt.isLoading}
              className="rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-3 py-1 text-[11px] font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
            >
              {claim.isPending || claimReceipt.isLoading
                ? "Claiming..."
                : `Claim ${formatAmount(claimAmount, WNVDAX_DECIMALS)} ${config.symbol}`}
            </button>
          )}
        </Step>

        <Step done={isConnected && hasUsdg} n={3} label="USDG, only to lend or repay interest" optional>
          <a
            href="https://faucet.paxos.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:underline"
          >
            Paxos faucet ↗
          </a>
        </Step>
      </ol>

      <TxStatus
        hash={claim.data}
        isPending={claim.isPending}
        isConfirming={claimReceipt.isLoading}
        isSuccess={claimReceipt.isSuccess}
        error={claim.error}
        successLabel="Claimed. You can supply it as collateral now."
      />
    </div>
  );
}

function Step({
  done,
  n,
  label,
  optional,
  children,
}: {
  done: boolean;
  n: number;
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
          done
            ? "bg-[var(--color-success)] text-[var(--color-accent-fg)]"
            : "border border-[var(--color-border)] text-[var(--color-text-faint)]"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span className="min-w-0 text-xs">
        <span className={done ? "text-[var(--color-text-faint)] line-through" : "text-[var(--color-text)]"}>{label}</span>
        {optional && !done && <span className="ml-1 text-[10px] text-[var(--color-text-faint)]">optional</span>}
        {!done && <span className="ml-2">{children}</span>}
      </span>
    </li>
  );
}
