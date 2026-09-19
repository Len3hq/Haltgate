"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { erc20Abi, parseUnits, formatUnits } from "viem";
import {
  useReadMarketFixedLoans,
  useReadMarketFixedMaxLtv,
  useReadMarketFixedRatePerYear,
  useReadMarketQuoteFixed,
  useReadMarketIsFixedDefaulted,
  useReadHaltControllerCanSupplyOrBorrow,
  useReadIPausableOracleLatestPrice,
  useWriteMarketBorrowFixed,
  useWriteMarketRepayFixed,
} from "@/lib/generated";
import { USDG_DECIMALS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { useMarketContracts } from "@/lib/market-context";
import { useNow } from "@/lib/use-now";
import { formatAmount, formatBps } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { TxStatus } from "@/components/dashboard/TxStatus";
import { InfoTip } from "@/components/dashboard/InfoTip";

const WAD = 10n ** 18n;
const TERMS = [
  { label: "1 day", seconds: 86_400n },
  { label: "7 days", seconds: 604_800n },
  { label: "14 days", seconds: 1_209_600n },
  { label: "30 days", seconds: 2_592_000n },
];

function toWad(amount: bigint, decimals: number): bigint {
  return decimals === 18 ? amount : amount * 10n ** BigInt(18 - decimals);
}
function fromWad(amountWad: bigint, decimals: number): bigint {
  return decimals === 18 ? amountWad : amountWad / 10n ** BigInt(18 - decimals);
}

function countdown(maturity: bigint, now: number): string {
  const left = Number(maturity) - now;
  if (left <= 0) return "Matured";
  if (left < 3600) return `${Math.ceil(left / 60)}m left`;
  if (left < 86400) return `${Math.ceil(left / 3600)}h left`;
  return `${Math.ceil(left / 86400)}d left`;
}

/// Fixed rate, fixed term, and no liquidation for the life of the loan.
/// Maturity replaces liquidation as the thing that resolves it, which is why
/// the LTV here is lower than the variable market's.
export function FixedTermPanel() {
  const CONTRACTS = useMarketContracts();
  const { address, isConnected } = useAccount();
  const [collateral, setCollateral] = useState("");
  const [borrow, setBorrow] = useState("");
  const [term, setTerm] = useState(TERMS[1].seconds);
  const queryClient = useQueryClient();
  const now = useNow(10_000);

  const { data: loan, refetch: refetchLoan } = useReadMarketFixedLoans({
    address: CONTRACTS.market,
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });
  const { data: fixedMaxLtv } = useReadMarketFixedMaxLtv({ address: CONTRACTS.market });
  const { data: fixedRate } = useReadMarketFixedRatePerYear({ address: CONTRACTS.market });
  const { data: canBorrow } = useReadHaltControllerCanSupplyOrBorrow({
    address: CONTRACTS.haltController,
    query: { refetchInterval: 6_000 },
  });
  const { data: priceData } = useReadIPausableOracleLatestPrice({ address: CONTRACTS.oracle, query: { refetchInterval: 10_000 } });
  const { data: isDefaulted } = useReadMarketIsFixedDefaulted({
    address: CONTRACTS.market,
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });
  const price = priceData?.[0];

  const { data: walletCollateral, refetch: refetchWallet } = useReadContract({
    address: CONTRACTS.wNVDAx,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });
  const { data: collAllowance, refetch: refetchCollAllowance } = useReadContract({
    address: CONTRACTS.wNVDAx,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.market] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });
  const { data: debtAllowance, refetch: refetchDebtAllowance } = useReadContract({
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.market] : undefined,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });

  const { data: vaultCash } = useReadContract({
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [CONTRACTS.lenderVault],
    query: { refetchInterval: 8_000 },
  });

  const parsedCollateral = useMemo(() => {
    try {
      return collateral ? parseUnits(collateral, WNVDAX_DECIMALS) : 0n;
    } catch {
      return 0n;
    }
  }, [collateral]);
  const parsedBorrow = useMemo(() => {
    try {
      return borrow ? parseUnits(borrow, USDG_DECIMALS) : 0n;
    } catch {
      return 0n;
    }
  }, [borrow]);

  const { data: quotedOwed } = useReadMarketQuoteFixed({
    address: CONTRACTS.market,
    args: parsedBorrow > 0n ? [parsedBorrow, term] : undefined,
    query: { enabled: parsedBorrow > 0n },
  });

  // Mirrors Market.borrowFixed's two ceilings: the LTV cap and the cash the
  // vault actually holds.
  const maxBorrowable = useMemo(() => {
    if (price === undefined || fixedMaxLtv === undefined || parsedCollateral === 0n) return 0n;
    const valueWad = (toWad(parsedCollateral, WNVDAX_DECIMALS) * price) / WAD;
    const byLtv = fromWad((valueWad * fixedMaxLtv) / WAD, USDG_DECIMALS);
    const cash = vaultCash ?? 0n;
    return byLtv < cash ? byLtv : cash;
  }, [price, fixedMaxLtv, parsedCollateral, vaultCash]);

  const hasLoan = loan !== undefined && loan[1] > 0n;
  const overLimit = parsedBorrow > maxBorrowable;
  const needsCollateralApproval = parsedCollateral > 0n && (collAllowance ?? 0n) < parsedCollateral;
  const needsDebtApproval = hasLoan && (debtAllowance ?? 0n) < (loan?.[2] ?? 0n);

  const approve = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approve.data });
  const borrowFixed = useWriteMarketBorrowFixed();
  const borrowReceipt = useWaitForTransactionReceipt({ hash: borrowFixed.data });
  const repayFixed = useWriteMarketRepayFixed();
  const repayReceipt = useWaitForTransactionReceipt({ hash: repayFixed.data });

  useEffect(() => {
    if (approveReceipt.isSuccess) {
      refetchCollAllowance();
      refetchDebtAllowance();
    }
  }, [approveReceipt.isSuccess, refetchCollAllowance, refetchDebtAllowance]);

  useEffect(() => {
    if (borrowReceipt.isSuccess || repayReceipt.isSuccess) {
      setCollateral("");
      setBorrow("");
      refetchLoan();
      refetchWallet();
      queryClient.invalidateQueries();
    }
  }, [borrowReceipt.isSuccess, repayReceipt.isSuccess, refetchLoan, refetchWallet, queryClient]);

  if (!isConnected) return null;

  const busy =
    approve.isPending || approveReceipt.isLoading || borrowFixed.isPending || borrowReceipt.isLoading || repayFixed.isPending || repayReceipt.isLoading;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Fixed Term</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Locked rate, fixed end date, and no liquidation for the whole term.
            <InfoTip
              align="left"
              text="Your position can never be closed out on price, however far the stock falls. Instead the loan simply ends on its maturity date: repay and get your collateral back, or the pool claims the collateral. Because nothing can liquidate you mid-term, you can borrow less against the same collateral than in the variable market."
            />
          </p>
        </div>
        <span className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text)]">
          {formatBps(fixedRate)} APR
        </span>
      </div>

      {hasLoan && loan ? (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-2 rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] p-3 text-center text-xs">
            <div>
              <p className="text-[var(--color-text-faint)]">Repay</p>
              <p className="mt-0.5 font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
                {formatAmount(loan[2], USDG_DECIMALS)} <span className="text-[10px] font-normal">USDG</span>
              </p>
            </div>
            <div>
              <p className="text-[var(--color-text-faint)]">Collateral locked</p>
              <p className="mt-0.5 font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
                {formatAmount(loan[0], WNVDAX_DECIMALS)}
              </p>
            </div>
            <div>
              <p className="text-[var(--color-text-faint)]">Due</p>
              <p
                className={`mt-0.5 font-[family-name:var(--font-display)] font-semibold ${
                  isDefaulted ? "text-[var(--color-error)]" : "text-[var(--color-text)]"
                }`}
              >
                {countdown(loan[3], now)}
              </p>
            </div>
          </div>

          {isDefaulted && (
            <p className="mt-3 rounded-[var(--radius-card)] bg-[var(--color-error-bg)] px-3 py-2 text-xs text-[var(--color-error)]">
              Past due. Anyone can now claim your collateral to close this out. Repaying still works until they do.
            </p>
          )}

          {needsDebtApproval ? (
            <>
              <button
                onClick={() =>
                  approve.writeContract({
                    address: CONTRACTS.usdg,
                    abi: erc20Abi,
                    functionName: "approve",
                    args: [CONTRACTS.market, loan[2]],
                  })
                }
                disabled={busy}
                className="mt-3 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
              >
                {busy ? "Approving..." : "Approve USDG"}
              </button>
              <TxStatus
                hash={approve.data}
                isPending={approve.isPending}
                isConfirming={approveReceipt.isLoading}
                isSuccess={approveReceipt.isSuccess}
                error={approve.error}
                successLabel="Approved. You can repay below."
              />
            </>
          ) : (
            <>
              <button
                onClick={() => repayFixed.writeContract({ address: CONTRACTS.market })}
                disabled={busy}
                className="mt-3 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
              >
                {busy ? "Confirming..." : "Repay and unlock collateral"}
              </button>
              <p className="mt-1.5 text-[11px] text-[var(--color-text-faint)]">Repaying works during a halt too.</p>
              <TxStatus
                hash={repayFixed.data}
                isPending={repayFixed.isPending}
                isConfirming={repayReceipt.isLoading}
                isSuccess={repayReceipt.isSuccess}
                error={repayFixed.error}
                successLabel="Repaid. Collateral returned."
              />
            </>
          )}
        </div>
      ) : (
        <div className="mt-4">
          {canBorrow === false && (
            <p className="mb-3 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
              New fixed-term loans are paused while the market is halted.
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>Collateral to lock</span>
            <span>
              Balance: {formatAmount(walletCollateral, WNVDAX_DECIMALS)}{" "}
              <button
                onClick={() => walletCollateral !== undefined && setCollateral(formatUnits(walletCollateral, WNVDAX_DECIMALS))}
                className="text-[var(--color-accent)] hover:underline"
              >
                Max
              </button>
            </span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
            placeholder="0.0"
            className="mt-1 w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-lg text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />

          <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>
              Borrow
              <InfoTip
                align="left"
                text={`Capped at ${fixedMaxLtv !== undefined ? formatBps(fixedMaxLtv) : "—"} of your collateral's value on this market, lower than the variable market's limit because nothing can liquidate this loan mid-term.`}
              />
            </span>
            <span>
              Max: {formatAmount(maxBorrowable, USDG_DECIMALS)} USDG{" "}
              <button
                onClick={() => setBorrow(formatUnits(maxBorrowable, USDG_DECIMALS))}
                className="text-[var(--color-accent)] hover:underline"
              >
                Max
              </button>
            </span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={borrow}
            onChange={(e) => setBorrow(e.target.value)}
            placeholder="0.0"
            className="mt-1 w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-lg text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />

          <p className="mt-3 text-xs text-[var(--color-text-muted)]">Term</p>
          <div className="mt-1 flex gap-1 rounded-[var(--radius-pill)] bg-[var(--color-bg-elevated)] p-1">
            {TERMS.map((t) => (
              <button
                key={t.label}
                onClick={() => setTerm(t.seconds)}
                className={`flex-1 rounded-[var(--radius-pill)] py-1.5 text-xs font-medium transition-colors ${
                  term === t.seconds ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]" : "text-[var(--color-text-muted)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {quotedOwed !== undefined && parsedBorrow > 0n && (
            <div className="mt-3 flex items-baseline justify-between rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] px-3 py-2.5 text-xs">
              <span className="text-[var(--color-text-muted)]">Total repayable at maturity</span>
              <span className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
                {formatAmount(quotedOwed, USDG_DECIMALS)} <span className="text-[10px] font-normal">USDG</span>
              </span>
            </div>
          )}

          {overLimit && (
            <p className="mt-3 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
              Above this market&apos;s fixed-term limit of {fixedMaxLtv !== undefined ? formatBps(fixedMaxLtv) : "—"}. Lower the amount
              or lock more collateral.
            </p>
          )}

          {needsCollateralApproval ? (
            <>
              <button
                onClick={() =>
                  approve.writeContract({
                    address: CONTRACTS.wNVDAx,
                    abi: erc20Abi,
                    functionName: "approve",
                    args: [CONTRACTS.market, parsedCollateral],
                  })
                }
                disabled={busy || parsedCollateral === 0n}
                className="mt-3 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
              >
                {busy ? "Approving..." : "Approve collateral"}
              </button>
              <TxStatus
                hash={approve.data}
                isPending={approve.isPending}
                isConfirming={approveReceipt.isLoading}
                isSuccess={approveReceipt.isSuccess}
                error={approve.error}
                successLabel="Approved. Open the loan below."
              />
            </>
          ) : (
            <>
              <button
                onClick={() =>
                  borrowFixed.writeContract({ address: CONTRACTS.market, args: [parsedCollateral, parsedBorrow, term] })
                }
                disabled={busy || parsedCollateral === 0n || parsedBorrow === 0n || overLimit || canBorrow === false}
                className="mt-3 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-50"
              >
                {busy ? "Confirming..." : "Open fixed-term loan"}
              </button>
              {borrowFixed.error && (
                <p className="mt-2 rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
                  {getErrorMessage(borrowFixed.error)}
                </p>
              )}
              <TxStatus
                hash={borrowFixed.data}
                isPending={borrowFixed.isPending}
                isConfirming={borrowReceipt.isLoading}
                isSuccess={borrowReceipt.isSuccess}
                error={borrowFixed.error}
                successLabel="Loan opened. Collateral is locked until maturity."
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
