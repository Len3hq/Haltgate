"use client";

import { useState } from "react";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, isAddress } from "viem";
import { useReadMockWrappedXStockOwner, useWriteMockWrappedXStockMint } from "@/lib/generated";
import { CONTRACTS, WNVDAX_DECIMALS } from "@/lib/contracts";

// wNVDAx.mint() is onlyOwner (correctly -- a real collateral token
// shouldn't let anyone mint it). Confirmed on-chain that the deployer is
// the sole owner, and that role was deliberately NOT transferred to
// governance along with Oracle/Market/HaltController. So this panel is
// honest about who can actually use it, rather than showing a mint button
// that would fail for everyone except one specific wallet.
export function FaucetPanel() {
  const { address, isConnected } = useAccount();
  const { data: owner } = useReadMockWrappedXStockOwner({ address: CONTRACTS.wNVDAx });
  const isOwner = isConnected && owner && address?.toLowerCase() === owner.toLowerCase();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("10");
  const mint = useWriteMockWrappedXStockMint();
  const mintReceipt = useWaitForTransactionReceipt({ hash: mint.data });

  function handleMint() {
    const to = recipient || address;
    if (!to || !isAddress(to)) return;
    mint.writeContract({
      address: CONTRACTS.wNVDAx,
      args: [to, parseUnits(amount || "0", WNVDAX_DECIMALS)],
    });
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Get Test Tokens</p>

      <div className="mt-3 flex items-center justify-between rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] px-3 py-2.5">
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

      <div className="mt-2">
        {isOwner ? (
          <div className="rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] p-3">
            <p className="text-sm text-[var(--color-text)]">Mint test wNVDAx</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              You&apos;re connected as the wNVDAx owner -- mint test collateral to any address for a demo.
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
            {mintReceipt.isSuccess && <p className="mt-2 text-xs text-[var(--color-success)]">Minted.</p>}
            {mint.error && <p className="mt-2 text-xs text-[var(--color-error)]">{mint.error.message.split("\n")[0]}</p>}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] px-3 py-2.5">
            <span className="text-sm text-[var(--color-text)]">wNVDAx (mock collateral)</span>
            <span className="text-xs text-[var(--color-text-faint)]">Contact the demo host for test wNVDAx</span>
          </div>
        )}
      </div>
    </div>
  );
}
