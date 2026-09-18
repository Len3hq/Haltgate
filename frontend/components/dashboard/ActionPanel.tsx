"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSimulateContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { erc20Abi, parseUnits } from "viem";
import {
  marketAbi,
  useWriteMarketSupply,
  useWriteMarketWithdraw,
  useWriteMarketBorrow,
  useWriteMarketRepay,
  useReadMarketGetPosition,
  useReadHaltControllerCanSupplyOrBorrow,
} from "@/lib/generated";
import { USDG_DECIMALS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { TxStatus } from "@/components/dashboard/TxStatus";
import { useMarketContracts } from "@/lib/market-context";

type Tab = "supply" | "withdraw" | "borrow" | "repay";

// Token addresses now vary by selected market, so only the static shape lives
// here -- the address is resolved per render in the component below.
const TAB_CONFIG: Record<Tab, { label: string; token: "collateral" | "USDG"; decimals: number; needsApproval: boolean }> = {
  supply: { label: "Supply", token: "collateral", decimals: WNVDAX_DECIMALS, needsApproval: true },
  withdraw: { label: "Withdraw", token: "collateral", decimals: WNVDAX_DECIMALS, needsApproval: false },
  borrow: { label: "Borrow", token: "USDG", decimals: USDG_DECIMALS, needsApproval: false },
  repay: { label: "Repay", token: "USDG", decimals: USDG_DECIMALS, needsApproval: true },
};

export function ActionPanel() {
  const CONTRACTS = useMarketContracts();
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("supply");
  const [amount, setAmount] = useState("");
  const queryClient = useQueryClient();

  const config = TAB_CONFIG[tab];
  const tokenAddress = config.token === "USDG" ? CONTRACTS.usdg : CONTRACTS.wNVDAx;
  const { data: canSupplyOrBorrow } = useReadHaltControllerCanSupplyOrBorrow({
    address: CONTRACTS.haltController,
    query: { refetchInterval: 6_000 },
  });
  const actionDisabledByHalt = (tab === "supply" || tab === "borrow") && canSupplyOrBorrow === false;

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });

  // Withdraw draws down supplied collateral and Repay pays off debt --
  // neither one is bounded by wallet balance, so "Max" for both needs to
  // reflect the position, not what's sitting in the wallet. (Repay's debt
  // figure can drift a few seconds stale between polls since interest
  // accrues continuously; the contract caps repayAmount at whatever the
  // live debt actually is at submission time, so a stale Max just means
  // repaying a hair under 100% rather than erroring.)
  const { data: position, refetch: refetchPosition } = useReadMarketGetPosition({
    address: CONTRACTS.market,
    args: address ? [address] : undefined,
    query: { enabled: !!address && (tab === "withdraw" || tab === "repay"), refetchInterval: 8_000 },
  });
  const suppliedCollateral = position?.[0];
  const currentDebt = position?.[1];

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.market] : undefined,
    query: { enabled: !!address && config.needsApproval, refetchInterval: 8_000 },
  });

  // Available to borrow == the vault's own USDG balance -- cash actually
  // lives in LenderVault, not Market; deposits/repayments add to it,
  // borrow()/liquidate() draw it down. Checked up front so an undersupplied
  // vault fails with a clear message instead of an opaque wallet error.
  const { data: availableLiquidity, refetch: refetchLiquidity } = useReadContract({
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [CONTRACTS.lenderVault],
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

  // Wallets run their own gas-estimation simulation before letting the user
  // hit Confirm, and reverts show as a generic, undecoded "third-party
  // contract execution error" banner inside the wallet's own UI -- our
  // TxStatus decoding never gets a chance to run, because no tx is ever
  // submitted for us to see an error on. Simulating the call ourselves,
  // client-side, catches the same revert first and lets us show the decoded
  // reason in-app, before the wallet ever opens.
  const simulate = useSimulateContract({
    address: CONTRACTS.market,
    abi: marketAbi,
    functionName: tab,
    args: [parsedAmount],
    query: { enabled: !!address && parsedAmount > 0n && !needsApproval },
  });

  const approve = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approve.data });

  const supply = useWriteMarketSupply();
  const supplyReceipt = useWaitForTransactionReceipt({ hash: supply.data });
  const withdraw = useWriteMarketWithdraw();
  const withdrawReceipt = useWaitForTransactionReceipt({ hash: withdraw.data });
  const borrow = useWriteMarketBorrow();
  const borrowReceipt = useWaitForTransactionReceipt({ hash: borrow.data });
  const repay = useWriteMarketRepay();
  const repayReceipt = useWaitForTransactionReceipt({ hash: repay.data });

  const action = tab === "supply" ? supply : tab === "withdraw" ? withdraw : tab === "borrow" ? borrow : repay;
  const actionReceipt =
    tab === "supply" ? supplyReceipt : tab === "withdraw" ? withdrawReceipt : tab === "borrow" ? borrowReceipt : repayReceipt;

  useEffect(() => {
    if (actionReceipt.isSuccess) {
      setAmount("");
      refetchBalance();
      refetchAllowance();
      refetchLiquidity();
      refetchPosition();
      // Position, totals, and other panels poll independently -- invalidate
      // everything so they reflect this tx immediately instead of waiting
      // out their own interval (previously required a manual page refresh).
      queryClient.invalidateQueries();
    }
  }, [actionReceipt.isSuccess, refetchBalance, refetchAllowance, refetchLiquidity, refetchPosition, queryClient]);

  useEffect(() => {
    if (approveReceipt.isSuccess) refetchAllowance();
  }, [approveReceipt.isSuccess, refetchAllowance]);

  function handleApprove() {
    approve.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.market, parsedAmount],
    });
  }

  function handleAction() {
    if (tab === "supply") supply.writeContract({ address: CONTRACTS.market, args: [parsedAmount] });
    if (tab === "withdraw") withdraw.writeContract({ address: CONTRACTS.market, args: [parsedAmount] });
    if (tab === "borrow") borrow.writeContract({ address: CONTRACTS.market, args: [parsedAmount] });
    if (tab === "repay") repay.writeContract({ address: CONTRACTS.market, args: [parsedAmount] });
  }

  function handleMax() {
    const maxValue = tab === "withdraw" ? suppliedCollateral : tab === "repay" ? currentDebt : balance;
    if (maxValue === undefined) return;
    setAmount(formatMaxInput(maxValue, config.decimals));
  }

  if (!isConnected) return null;

  const isBusy = approve.isPending || approveReceipt.isLoading || action.isPending || actionReceipt.isLoading;
  const simulationActive = parsedAmount > 0n && !needsApproval;
  // isPending stays true, not false, for a query that hasn't run yet (e.g.
  // disabled, or its key just changed) -- so "no error yet" during that
  // window means "haven't checked yet," not "safe to submit." The button
  // must stay disabled for that whole window, not just once an error lands,
  // or a fast click right after typing can still reach the wallet unchecked.
  const simulationPending = simulationActive && simulate.isPending;
  const simulationBlocked = simulationActive && !simulate.isPending && !!simulate.error;
  const canSubmit =
    parsedAmount > 0n && !isBusy && !actionDisabledByHalt && !insufficientLiquidity && !simulationPending && !simulationBlocked;

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
      {tab === "withdraw" && (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          If you have outstanding debt, you can only withdraw down to what keeps you within the max LTV.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>Amount ({config.token})</span>
        <span>
          {tab === "withdraw" ? "Supplied" : tab === "repay" ? "Owed" : "Balance"}:{" "}
          {formatAmount(tab === "withdraw" ? suppliedCollateral : tab === "repay" ? currentDebt : balance, config.decimals)}{" "}
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
            {isBusy ? "Confirming..." : simulationPending ? "Checking..." : TAB_CONFIG[tab].label}
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
