"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { erc20Abi, parseUnits, isAddress, type Address } from "viem";
import {
  useReadMarketIsLiquidatable,
  useReadMarketHealthFactor,
  useReadHaltControllerCanLiquidate,
  useWriteMarketLiquidate,
} from "@/lib/generated";
import { CONTRACTS, USDG_DECIMALS } from "@/lib/contracts";

const MAX_UINT256 = (1n << 256n) - 1n;

export function LiquidatePanel() {
  const { address: connected } = useAccount();
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");

  const targetAddress = isAddress(target) ? (target as Address) : undefined;

  const { data: canLiquidate } = useReadHaltControllerCanLiquidate({
    address: CONTRACTS.haltController,
    query: { refetchInterval: 6_000 },
  });
  const { data: isLiquidatable } = useReadMarketIsLiquidatable({
    address: CONTRACTS.market,
    args: targetAddress ? [targetAddress] : undefined,
    query: { enabled: !!targetAddress, refetchInterval: 6_000 },
  });
  const { data: healthFactor } = useReadMarketHealthFactor({
    address: CONTRACTS.market,
    args: targetAddress ? [targetAddress] : undefined,
    query: { enabled: !!targetAddress, refetchInterval: 6_000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "allowance",
    args: connected ? [connected, CONTRACTS.market] : undefined,
    query: { enabled: !!connected, refetchInterval: 8_000 },
  });

  const parsedAmount = useMemo(() => {
    if (!amount) return 0n;
    try {
      return parseUnits(amount, USDG_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  const needsApproval = (allowance ?? 0n) < parsedAmount;

  const approve = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approve.data });
  const liquidate = useWriteMarketLiquidate();
  const liquidateReceipt = useWaitForTransactionReceipt({ hash: liquidate.data });

  useEffect(() => {
    if (approveReceipt.isSuccess) refetchAllowance();
  }, [approveReceipt.isSuccess, refetchAllowance]);
  useEffect(() => {
    if (liquidateReceipt.isSuccess) setAmount("");
  }, [liquidateReceipt.isSuccess]);

  function handleApprove() {
    approve.writeContract({ address: CONTRACTS.usdg, abi: erc20Abi, functionName: "approve", args: [CONTRACTS.market, parsedAmount] });
  }

  function handleLiquidate() {
    if (!targetAddress) return;
    liquidate.writeContract({ address: CONTRACTS.market, args: [targetAddress, parsedAmount] });
  }

  const hfDisplay = healthFactor === undefined ? "--" : healthFactor === MAX_UINT256 ? "No debt" : (Number(healthFactor) / 1e18).toFixed(2);
  const isBusy = approve.isPending || approveReceipt.isLoading || liquidate.isPending || liquidateReceipt.isLoading;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Liquidate a Position</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Anyone can liquidate an undercollateralized position -- repay some of its debt, receive its collateral at a discount.
      </p>

      <input
        type="text"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="Address to check (0x...)"
        className="mt-3 w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
      />

      {targetAddress && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-[var(--color-text-muted)]">Health factor: {hfDisplay}</span>
          <span className={isLiquidatable ? "text-[var(--color-error)]" : "text-[var(--color-success)]"}>
            {isLiquidatable ? "Liquidatable" : "Healthy"}
          </span>
        </div>
      )}

      {canLiquidate === false && (
        <p className="mt-2 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
          Liquidations are paused right now -- see the status banner above.
        </p>
      )}

      {targetAddress && isLiquidatable && (
        <div className="mt-3">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount to repay (USDG)"
            className="w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />
          {needsApproval ? (
            <button
              onClick={handleApprove}
              disabled={parsedAmount === 0n || isBusy}
              className="mt-2 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
            >
              {isBusy ? "Approving..." : "Approve USDG"}
            </button>
          ) : (
            <button
              onClick={handleLiquidate}
              disabled={parsedAmount === 0n || isBusy || canLiquidate === false}
              className="mt-2 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
            >
              {isBusy ? "Confirming..." : "Liquidate"}
            </button>
          )}
          {liquidate.error && <p className="mt-2 text-xs text-[var(--color-error)]">{liquidate.error.message.split("\n")[0]}</p>}
          {liquidateReceipt.isSuccess && <p className="mt-2 text-xs text-[var(--color-success)]">Liquidated.</p>}
        </div>
      )}
    </div>
  );
}
