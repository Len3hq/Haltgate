"use client";

import {
  useReadHaltControllerState,
  useReadHaltControllerHaltStartedAt,
  useReadHaltControllerSettlementAvailableAt,
  useReadHaltControllerSettlementDelay,
  useReadHaltControllerInterestFrozen,
  useReadHaltControllerCanSupplyOrBorrow,
  useReadHaltControllerCanLiquidate,
} from "@/lib/generated";
import { useMarketContracts } from "@/lib/market-context";
import { useNow } from "@/lib/use-now";
import { InfoTip } from "@/components/dashboard/InfoTip";

const STATE_LABEL = ["OPEN", "HALTING", "HALTED", "RESUMING", "SETTLING"] as const;

function duration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function Row({ label, allowed, note, tip }: { label: string; allowed: boolean | undefined; note?: string; tip: string }) {
  const tone =
    allowed === undefined
      ? "text-[var(--color-text-faint)]"
      : allowed
        ? "text-[var(--color-success)]"
        : "text-[var(--color-error)]";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-[var(--color-text-muted)]">
        {label}
        {note && <span className="ml-1.5 text-[10px] text-[var(--color-text-faint)]">{note}</span>}
        <InfoTip text={tip} align="left" />
      </span>
      <span className={`text-xs font-medium ${tone}`}>
        {allowed === undefined ? "—" : allowed ? "Allowed" : "Blocked"}
      </span>
    </div>
  );
}

/// Where Kamino puts utilization history, HaltGate puts the thing only it has:
/// exactly what the halt state machine is permitting right now, and when the
/// settlement backstop unlocks.
export function HaltSettlementPanel() {
  const CONTRACTS = useMarketContracts();
  const poll = { refetchInterval: 8_000 };

  const { data: state } = useReadHaltControllerState({ address: CONTRACTS.haltController, query: poll });
  const { data: haltStartedAt } = useReadHaltControllerHaltStartedAt({ address: CONTRACTS.haltController, query: poll });
  const { data: settlementAt } = useReadHaltControllerSettlementAvailableAt({ address: CONTRACTS.haltController, query: poll });
  const { data: settlementDelay } = useReadHaltControllerSettlementDelay({ address: CONTRACTS.haltController });
  const { data: interestFrozen } = useReadHaltControllerInterestFrozen({ address: CONTRACTS.haltController, query: poll });
  const { data: canSupplyOrBorrow } = useReadHaltControllerCanSupplyOrBorrow({ address: CONTRACTS.haltController, query: poll });
  const { data: canLiquidate } = useReadHaltControllerCanLiquidate({ address: CONTRACTS.haltController, query: poll });

  const label = state === undefined ? "OPEN" : (STATE_LABEL[state] ?? "OPEN");
  const now = useNow();
  const inStateFor = haltStartedAt !== undefined && haltStartedAt > 0n ? now - Number(haltStartedAt) : null;
  const untilSettlement = settlementAt !== undefined && settlementAt > 0n ? Number(settlementAt) - now : null;

  return (
    <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Halt &amp; Settlement</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">State: {label}</p>
      </div>

      <div className="mt-3 divide-y divide-[var(--color-border-subtle)]">
        <Row
          label="Supply &amp; borrow"
          allowed={canSupplyOrBorrow}
          tip="Taking on new exposure is only allowed while the price feed is trustworthy. A halt blocks it until the corporate action resolves."
        />
        <Row
          label="Liquidation"
          allowed={canLiquidate}
          note="stays off until fully reopened"
          tip="Liquidations stay disabled through RESUMING, not just HALTED. The moment right after a price unfreezes is the most dangerous time to liquidate, because a position can look underwater for a purely mechanical reason like a split."
        />
        <Row
          label="Repay"
          allowed={true}
          note="never blocked"
          tip="Repaying is allowed in every state, halts included. Paying down debt only shrinks the borrower's risk and returns cash to lenders, so there is never a reason to block it."
        />
        <Row
          label="Interest accrual"
          allowed={interestFrozen === undefined ? undefined : !interestFrozen}
          note={interestFrozen ? "frozen" : undefined}
          tip="Debt stops growing while the market is halted. Charging interest when liquidation is disabled and the price is frozen would push borrowers toward a liquidation they cannot defend against."
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] px-3 py-2">
          <p className="text-[10px] text-[var(--color-text-faint)]">Restricted for</p>
          <p className="mt-0.5 font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
            {inStateFor === null ? "Not restricted" : duration(inStateFor)}
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)] px-3 py-2">
          <p className="text-[10px] text-[var(--color-text-faint)]">Settlement unlocks</p>
          <p className="mt-0.5 font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
            {untilSettlement === null
              ? settlementDelay !== undefined
                ? `after ${duration(Number(settlementDelay))}`
                : "—"
              : untilSettlement <= 0
                ? "Available now"
                : `in ${duration(untilSettlement)}`}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-snug text-[var(--color-text-muted)]">
        If a halt outlasts its limit, anyone can open settlement and lenders withdraw their proportional share of
        available cash. Borrowing and liquidation stay shut until the price is trustworthy again.
      </p>
    </div>
  );
}
