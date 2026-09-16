"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { erc20Abi, parseUnits } from "viem";
import {
  useWriteMarketSupply,
  useWriteMarketBorrow,
  useWriteMarketRepay,
  useReadHaltControllerCanSupplyOrBorrow,
} from "@/lib/generated";
import { CONTRACTS, USDG_DECIMALS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
import { TxStatus } from "@/components/TxStatus";

type Tab = "supply" | "borrow" | "repay";

const TAB_CONFIG: Record<Tab, { label: string; token: "wNVDAx" | "USDG"; tokenAddress: `0x${string}`; decimals: number; needsApproval: boolean }> = {
  supply: { label: "Supply", token: "wNVDAx", tokenAddress: CONTRACTS.wNVDAx, decimals: WNVDAX_DECIMALS, needsApproval: true },
  borrow: { label: "Borrow", token: "USDG", tokenAddress: CONTRACTS.usdg, decimals: USDG_DECIMALS, needsApproval: false },
  repay: { label: "Repay", token: "USDG", tokenAddress: CONTRACTS.usdg, decimals: USDG_DECIMALS, needsApproval: true },
};

export function ActionPanel() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("supply");
  const [amount, setAmount] = useState("");
  const queryClient = useQueryClient();

  const config = TAB_CONFIG[tab];
  const { data: canSupplyOrBorrow } = useReadHaltControllerCanSupplyOrBorrow({
    address: CONTRACTS.haltController,
    query: { refetchInterval: 6_000 },
  });
  const actionDisabledByHalt = (tab === "supply" || tab === "borrow") && canSupplyOrBorrow === false;

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: config.tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: config.tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.market] : undefined,
    query: { enabled: !!address && config.needsApproval, refetchInterval: 8_000 },
  });

  // Available to borrow == the market's own USDG balance -- fundMarket() and repay()
  // add to it, borrow() and liquidate() draw it down. Checked up front so an
  // undersupplied market fails with a clear message instead of an opaque wallet error.
  const { data: availableLiquidity, refetch: refetchLiquidity } = useReadContract({
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [CONTRACTS.market],
    query: { enabled: tab === "borrow", refetchInterval: 8_000 },
  });

  const parsedAmount = useMemo(() => {
    if (!amount) return 0n;
    try {
      return parseUnits(amount, config.decimals);
    } catch {
      return 0n;
    }
  }, [amount, config.decimals]);

  const needsApproval = config.needsApproval && (allowance ?? 0n) < parsedAmount;
  const insufficientLiquidity = tab === "borrow" && availableLiquidity !== undefined && parsedAmount > availableLiquidity;

  const approve = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approve.data });

  const supply = useWriteMarketSupply();
  const supplyReceipt = useWaitForTransactionReceipt({ hash: supply.data });
  const borrow = useWriteMarketBorrow();
  const borrowReceipt = useWaitForTransactionReceipt({ hash: borrow.data });
  const repay = useWriteMarketRepay();
  const repayReceipt = useWaitForTransactionReceipt({ hash: repay.data });

  const action = tab === "supply" ? supply : tab === "borrow" ? borrow : repay;
  const actionReceipt = tab === "supply" ? supplyReceipt : tab === "borrow" ? borrowReceipt : repayReceipt;

  useEffect(() => {
    if (actionReceipt.isSuccess) {
      setAmount("");
      refetchBalance();
      refetchAllowance();
      refetchLiquidity();
      // Position, totals, and other panels poll independently -- invalidate
      // everything so they reflect this tx immediately instead of waiting
      // out their own interval (previously required a manual page refresh).
      queryClient.invalidateQueries();
    }
  }, [actionReceipt.isSuccess, refetchBalance, refetchAllowance, refetchLiquidity, queryClient]);

  useEffect(() => {
    if (approveReceipt.isSuccess) refetchAllowance();
  }, [approveReceipt.isSuccess, refetchAllowance]);

  function handleApprove() {
    approve.writeContract({
      address: config.tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.market, parsedAmount],
    });
  }

  function handleAction() {
    if (tab === "supply") supply.writeContract({ address: CONTRACTS.market, args: [parsedAmount] });
    if (tab === "borrow") borrow.writeContract({ address: CONTRACTS.market, args: [parsedAmount] });
    if (tab === "repay") repay.writeContract({ address: CONTRACTS.market, args: [parsedAmount] });
  }

  function handleMax() {
    if (balance === undefined) return;
    setAmount(formatMaxInput(balance, config.decimals));
  }

  if (!isConnected) return null;

  const isBusy = approve.isPending || approveReceipt.isLoading || action.isPending || actionReceipt.isLoading;
  const canSubmit = parsedAmount > 0n && !isBusy && !actionDisabledByHalt && !insufficientLiquidity;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex gap-1 rounded-[var(--radius-pill)] bg-[var(--color-bg-elevated)] p-1">
        {(Object.keys(TAB_CONFIG) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setAmount("");
            }}
            className={`flex-1 rounded-[var(--radius-pill)] py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]" : "text-[var(--color-text-muted)]"
            }`}
          >
            {TAB_CONFIG[t].label}
          </button>
        ))}
      </div>

      {actionDisabledByHalt && (
        <p className="mt-3 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
          Market isn&apos;t open for {tab === "supply" ? "supply" : "borrowing"} right now -- see the status banner above.
        </p>
      )}

      {tab === "borrow" && (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Available to borrow: {formatAmount(availableLiquidity, USDG_DECIMALS)} USDG
        </p>
      )}
      {insufficientLiquidity && (
        <p className="mt-1 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
          The market only has {formatAmount(availableLiquidity, USDG_DECIMALS)} USDG available right now -- lower the amount.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>Amount ({config.token})</span>
        <span>
          Balance: {formatAmount(balance, config.decimals)}{" "}
          <button onClick={handleMax} className="text-[var(--color-accent)] hover:underline">
            Max
          </button>
        </span>
      </div>
      <input
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.0"
        className="mt-1 w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-lg text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
      />

      {needsApproval ? (
        <>
          <button
            onClick={handleApprove}
            disabled={parsedAmount === 0n || approve.isPending || approveReceipt.isLoading}
            className="mt-3 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
          >
            {approve.isPending || approveReceipt.isLoading ? "Approving..." : `Approve ${config.token}`}
          </button>
          <TxStatus
            hash={approve.data}
            isPending={approve.isPending}
            isConfirming={approveReceipt.isLoading}
            isSuccess={approveReceipt.isSuccess}
            error={approve.error}
            pendingLabel="Confirm approval in wallet..."
            successLabel="Approved -- you can now submit the transaction below."
          />
        </>
      ) : (
        <>
          <button
            onClick={handleAction}
            disabled={!canSubmit}
            className="mt-3 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
          >
            {isBusy ? "Confirming..." : TAB_CONFIG[tab].label}
          </button>
          <TxStatus
            hash={action.data}
            isPending={action.isPending}
            isConfirming={actionReceipt.isLoading}
            isSuccess={actionReceipt.isSuccess}
            error={action.error}
          />
        </>
      )}
    </div>
  );
}

function formatMaxInput(value: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(decimals, "0")}`.replace(/0+$/, "").replace(/\.$/, "");
}
