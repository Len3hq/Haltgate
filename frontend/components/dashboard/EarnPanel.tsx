"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSimulateContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { erc20Abi, parseUnits } from "viem";
import {
  lenderVaultAbi,
  useWriteLenderVaultDeposit,
  useWriteLenderVaultWithdraw,
  useReadLenderVaultBalanceOf,
  useReadLenderVaultConvertToAssets,
  useReadLenderVaultMaxWithdraw,
  useReadMarketTotalBorrows,
  useReadMarketReserveFactor,
  useReadInterestRateModelGetSupplyRatePerSecond,
  useReadHaltControllerCanLiquidate,
  useReadHaltControllerIsSettling,
} from "@/lib/generated";
import { USDG_DECIMALS } from "@/lib/contracts";
import { formatAmount, formatApr } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { TxStatus } from "@/components/dashboard/TxStatus";
import { useMarketContracts } from "@/lib/market-context";

type Tab = "deposit" | "withdraw";

export function EarnPanel() {
  const CONTRACTS = useMarketContracts();
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const queryClient = useQueryClient();

  const { data: walletBalance, refetch: refetchWalletBalance } = useReadContract({
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && tab === "deposit", refetchInterval: 8_000 },
  });

  const { data: shareBalance, refetch: refetchShareBalance } = useReadLenderVaultBalanceOf({
    address: CONTRACTS.lenderVault,
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });
  const { data: depositedValue, refetch: refetchDepositedValue } = useReadLenderVaultConvertToAssets({
    address: CONTRACTS.lenderVault,
    args: shareBalance !== undefined ? [shareBalance] : undefined,
    query: { enabled: shareBalance !== undefined, refetchInterval: 8_000 },
  });
  const { data: maxWithdrawable, refetch: refetchMaxWithdrawable } = useReadLenderVaultMaxWithdraw({
    address: CONTRACTS.lenderVault,
    args: address ? [address] : undefined,
    query: { enabled: !!address && tab === "withdraw", refetchInterval: 8_000 },
  });
  // maxWithdraw is zero both when the market is halted (redemptions are
  // gated the same way liquidations are -- see LenderVault.maxRedeem) and,
  // separately, when cash is just genuinely out on loan. Read halt state
  // directly so the warning below names the right one instead of always
  // blaming borrowers.
  const { data: canLiquidate } = useReadHaltControllerCanLiquidate({
    address: CONTRACTS.haltController,
    query: { enabled: tab === "withdraw", refetchInterval: 6_000 },
  });
  // Settlement is a third case on top of those two: withdrawals are open
  // again, but capped at a pro-rata slice rather than the whole liquid pot.
  const { data: isSettling } = useReadHaltControllerIsSettling({
    address: CONTRACTS.haltController,
    query: { enabled: tab === "withdraw", refetchInterval: 6_000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.lenderVault] : undefined,
    query: { enabled: !!address && tab === "deposit", refetchInterval: 8_000 },
  });

  // Live supply APR, shown right on the panel that actually pays it out.
  const { data: vaultCash } = useReadContract({
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [CONTRACTS.lenderVault],
    query: { refetchInterval: 10_000 },
  });
  const { data: totalBorrows } = useReadMarketTotalBorrows({ address: CONTRACTS.market, query: { refetchInterval: 10_000 } });
  const { data: reserveFactor } = useReadMarketReserveFactor({ address: CONTRACTS.market });
  const { data: supplyRate } = useReadInterestRateModelGetSupplyRatePerSecond({
    address: CONTRACTS.interestRateModel,
    args:
      vaultCash !== undefined && totalBorrows !== undefined && reserveFactor !== undefined
        ? [vaultCash, totalBorrows, reserveFactor]
        : undefined,
    query: { enabled: vaultCash !== undefined && totalBorrows !== undefined && reserveFactor !== undefined, refetchInterval: 10_000 },
  });

  const parsedAmount = useMemo(() => {
    if (!amount) return 0n;
    try {
      return parseUnits(amount, USDG_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  const needsApproval = tab === "deposit" && (allowance ?? 0n) < parsedAmount;
  const insufficientLiquidity = tab === "withdraw" && maxWithdrawable !== undefined && parsedAmount > maxWithdrawable;

  const approve = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approve.data });
  const deposit = useWriteLenderVaultDeposit();
  const depositReceipt = useWaitForTransactionReceipt({ hash: deposit.data });
  const withdraw = useWriteLenderVaultWithdraw();
  const withdrawReceipt = useWaitForTransactionReceipt({ hash: withdraw.data });

  const action = tab === "deposit" ? deposit : withdraw;
  const actionReceipt = tab === "deposit" ? depositReceipt : withdrawReceipt;

  // Same reasoning as ActionPanel/LiquidatePanel: catch a would-be revert
  // (e.g. withdrawing more than maxWithdraw allows) ourselves before the
  // wallet's own gas-estimation preflight blocks the user with an
  // undecoded generic error.
  const simulate = useSimulateContract({
    address: CONTRACTS.lenderVault,
    abi: lenderVaultAbi,
    functionName: tab === "deposit" ? "deposit" : "withdraw",
    args: address ? (tab === "deposit" ? [parsedAmount, address] : [parsedAmount, address, address]) : undefined,
    query: { enabled: !!address && parsedAmount > 0n && !needsApproval },
  });
  const simulationActive = parsedAmount > 0n && !needsApproval;
  const simulationPending = simulationActive && simulate.isPending;
  const simulationBlocked = simulationActive && !simulate.isPending && !!simulate.error;

  useEffect(() => {
    if (actionReceipt.isSuccess) {
      setAmount("");
      refetchWalletBalance();
      refetchShareBalance();
      refetchDepositedValue();
      refetchMaxWithdrawable();
      refetchAllowance();
      queryClient.invalidateQueries();
    }
  }, [actionReceipt.isSuccess, refetchWalletBalance, refetchShareBalance, refetchDepositedValue, refetchMaxWithdrawable, refetchAllowance, queryClient]);

  useEffect(() => {
    if (approveReceipt.isSuccess) refetchAllowance();
  }, [approveReceipt.isSuccess, refetchAllowance]);

  function handleApprove() {
    approve.writeContract({ address: CONTRACTS.usdg, abi: erc20Abi, functionName: "approve", args: [CONTRACTS.lenderVault, parsedAmount] });
  }

  function handleAction() {
    if (!address) return;
    if (tab === "deposit") deposit.writeContract({ address: CONTRACTS.lenderVault, args: [parsedAmount, address] });
    if (tab === "withdraw") withdraw.writeContract({ address: CONTRACTS.lenderVault, args: [parsedAmount, address, address] });
  }

  function handleMax() {
    const maxValue = tab === "deposit" ? walletBalance : maxWithdrawable;
    if (maxValue === undefined) return;
    setAmount(formatMaxInput(maxValue, USDG_DECIMALS));
  }

  if (!isConnected) return null;

  const isBusy = approve.isPending || approveReceipt.isLoading || action.isPending || actionReceipt.isLoading;
  const canSubmit = parsedAmount > 0n && !isBusy && !insufficientLiquidity && !simulationPending && !simulationBlocked;

  return (
    <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Earn</p>
        <span className="rounded-[var(--radius-pill)] bg-[var(--color-success-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-success)]">
          {formatApr(supplyRate)} APR
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Deposit USDG into the lending pool and earn what borrowers pay in interest.
      </p>

      <div className="mt-4 rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] px-3 py-2.5">
        <p className="text-xs text-[var(--color-text-muted)]">Your deposit</p>
        <p className="mt-0.5 text-lg font-semibold text-[var(--color-text)]">{formatAmount(depositedValue, USDG_DECIMALS)} USDG</p>
      </div>

      <div className="mt-4 flex gap-1 rounded-[var(--radius-pill)] bg-[var(--color-bg-elevated)] p-1">
        {(["deposit", "withdraw"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setAmount("");
            }}
            className={`flex-1 rounded-[var(--radius-pill)] py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]" : "text-[var(--color-text-muted)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "withdraw" && canLiquidate === false && isSettling !== true && (
        <p className="mt-3 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
          Withdrawals are paused while the market is halted — see the status banner above. Deposits still work as normal.
        </p>
      )}
      {tab === "withdraw" && isSettling === true && (
        <p className="mt-3 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
          Settlement is open: you can withdraw your proportional share of whatever USDG is currently liquid. The rest stays claimable as
          borrowers repay — nobody can drain the pool ahead of you.
        </p>
      )}
      {insufficientLiquidity && canLiquidate !== false && (
        <p className="mt-3 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
          Only {formatAmount(maxWithdrawable, USDG_DECIMALS)} USDG is liquid right now — the rest is out on loan to borrowers.
        </p>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>Amount (USDG)</span>
        <span>
          {tab === "deposit" ? "Balance" : "Available"}: {formatAmount(tab === "deposit" ? walletBalance : maxWithdrawable, USDG_DECIMALS)}{" "}
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
            {approve.isPending || approveReceipt.isLoading ? "Approving..." : "Approve USDG"}
          </button>
          <TxStatus
            hash={approve.data}
            isPending={approve.isPending}
            isConfirming={approveReceipt.isLoading}
            isSuccess={approveReceipt.isSuccess}
            error={approve.error}
            pendingLabel="Confirm approval in wallet..."
            successLabel="Approved — you can now submit the transaction below."
          />
        </>
      ) : (
        <>
          <button
            onClick={handleAction}
            disabled={!canSubmit}
            className="mt-3 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
          >
            {isBusy ? "Confirming..." : simulationPending ? "Checking..." : tab === "deposit" ? "Deposit" : "Withdraw"}
          </button>
          {simulationBlocked && (
            <p className="mt-2 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
              {getErrorMessage(simulate.error)}
            </p>
          )}
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
