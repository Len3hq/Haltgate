"use client";

import { useState, useEffect } from "react";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { parseUnits, isAddress } from "viem";
import {
  useReadMockWrappedXStockOwner,
  useWriteMockWrappedXStockMint,
  useReadWnvdAxFaucetHasClaimed,
  useReadWnvdAxFaucetClaimAmount,
  useWriteWnvdAxFaucetClaim,
} from "@/lib/generated";
import { WNVDAX_DECIMALS } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
import { TxStatus } from "@/components/dashboard/TxStatus";
import { useMarketContracts } from "@/lib/market-context";

// wNVDAx.mint() is deliberately onlyOwner (mirroring how a real collateral
// token would never let anyone mint it), so every tester previously had to
// ask the deployer to mint to them by hand. WNVDAxFaucet works around that
// without touching the token's own access control: it holds a stockpile the
// owner funded once, and anyone can self-serve a fixed amount from it,
// permissionlessly, one claim per address.
export function FaucetPanel() {
  const CONTRACTS = useMarketContracts();
  const { address, isConnected } = useAccount();
  const { data: owner } = useReadMockWrappedXStockOwner({ address: CONTRACTS.wNVDAx });
  const isOwner = isConnected && owner && address?.toLowerCase() === owner.toLowerCase();

  const { data: hasClaimed, refetch: refetchHasClaimed } = useReadWnvdAxFaucetHasClaimed({
    address: CONTRACTS.wNVDAxFaucet,
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });
  const { data: claimAmount } = useReadWnvdAxFaucetClaimAmount({ address: CONTRACTS.wNVDAxFaucet });
  const claim = useWriteWnvdAxFaucetClaim();
  const claimReceipt = useWaitForTransactionReceipt({ hash: claim.data });

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("10");
  const mint = useWriteMockWrappedXStockMint();
  const mintReceipt = useWaitForTransactionReceipt({ hash: mint.data });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (mintReceipt.isSuccess) queryClient.invalidateQueries();
  }, [mintReceipt.isSuccess, queryClient]);

  useEffect(() => {
    if (claimReceipt.isSuccess) {
      refetchHasClaimed();
      queryClient.invalidateQueries();
    }
  }, [claimReceipt.isSuccess, refetchHasClaimed, queryClient]);

  function handleMint() {
    const to = recipient || address;
    if (!to || !isAddress(to)) return;
    mint.writeContract({
      address: CONTRACTS.wNVDAx,
      args: [to, parseUnits(amount || "0", WNVDAX_DECIMALS)],
    });
  }

  function handleClaim() {
    claim.writeContract({ address: CONTRACTS.wNVDAxFaucet, args: [] });
  }

  return (
    <div>
      <div className="flex items-center justify-between rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] px-3 py-2.5">
        <span className="text-sm text-[var(--color-text)]">USDG (real testnet token)</span>
        <a
          href="https://faucet.paxos.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          Paxos Faucet ↗
        </a>
      </div>

      <div className="mt-2 rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-text)]">wNVDAx (mock collateral)</span>
          <button
            onClick={handleClaim}
            disabled={!isConnected || hasClaimed || claim.isPending || claimReceipt.isLoading}
            className="rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-4 py-1.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
          >
            {claim.isPending || claimReceipt.isLoading
              ? "Claiming..."
              : hasClaimed
                ? "Already claimed"
                : `Claim ${formatAmount(claimAmount, WNVDAX_DECIMALS)}`}
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">One-time self-serve claim per address — no owner needed.</p>
        <TxStatus
          hash={claim.data}
          isPending={claim.isPending}
          isConfirming={claimReceipt.isLoading}
          isSuccess={claimReceipt.isSuccess}
          error={claim.error}
          successLabel="Claimed."
        />
      </div>

      {isOwner && (
        <div className="mt-2 rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] p-3">
          <p className="text-sm text-[var(--color-text)]">Mint test wNVDAx (owner)</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            You&apos;re connected as the wNVDAx owner — mint any amount to any address, or restock the faucet above.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={address ?? "0x... (defaults to your address)"}
              className="flex-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            />
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] sm:w-24"
            />
            <button
              onClick={handleMint}
              disabled={mint.isPending || mintReceipt.isLoading}
              className="rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
            >
              {mint.isPending || mintReceipt.isLoading ? "Minting..." : "Mint"}
            </button>
          </div>
          <TxStatus
            hash={mint.data}
            isPending={mint.isPending}
            isConfirming={mintReceipt.isLoading}
            isSuccess={mintReceipt.isSuccess}
            error={mint.error}
            successLabel="Minted."
          />
        </div>
      )}
    </div>
  );
}
