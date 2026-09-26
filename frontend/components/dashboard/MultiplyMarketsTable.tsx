"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import {
  useReadHaltControllerState,
  useReadIPausableOracleLatestPrice,
  useReadMarketGetPosition,
  useReadMarketMaxLtv,
  useReadMarketTotalBorrows,
  useReadInterestRateModelGetBorrowRatePerSecond,
} from "@/lib/generated";
import { MARKETS, SHARED, USDG_DECIMALS, WNVDAX_DECIMALS, type MarketConfig } from "@/lib/contracts";
import { formatAmount, formatApr, formatPrice } from "@/lib/format";

const WAD = 10n ** 18n;

const STATE_LABEL = ["OPEN", "HALTING", "HALTED", "RESUMING", "SETTLING"] as const;

const STATE_STYLE: Record<string, string> = {
  OPEN: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  HALTING: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  HALTED: "bg-[var(--color-error-bg)] text-[var(--color-error)]",
  RESUMING: "bg-[var(--color-bg-elevated)] text-[var(--color-accent-blue)]",
  SETTLING: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
};

const COLS = "grid-cols-[1.4fr_0.9fr_0.8fr_0.8fr_0.9fr]";
/// One extra column once a wallet is connected: an open loop is easy to lose
/// track of when the panel that opened it sits a click away.
const COLS_WITH_POSITION = "grid-cols-[1.4fr_0.9fr_0.8fr_0.8fr_0.9fr_1fr]";

function toWad(amount: bigint, decimals: number): bigint {
  return decimals === 18 ? amount : amount * 10n ** BigInt(18 - decimals);
}

/// Exposure over equity, the same ratio the Multiply panel reports, so a row and
/// the panel it links to never disagree.
function currentLeverage(collateral: bigint, debt: bigint, price: bigint | undefined): string | null {
  if (price === undefined || price === 0n || collateral === 0n) return null;
  const collateralValueWad = (toWad(collateral, WNVDAX_DECIMALS) * price) / WAD;
  const debtWad = toWad(debt, USDG_DECIMALS);
  if (collateralValueWad <= debtWad) return null;
  return `${(Number(collateralValueWad) / Number(collateralValueWad - debtWad)).toFixed(2)}x`;
}

/// A market's ceiling is 1 / (1 - maxLTV), an asymptote the loop approaches
/// rather than reaches. Derived live so it stays right if the parameter moves.
function maxLeverage(maxLtv: bigint | undefined): string {
  if (maxLtv === undefined || maxLtv >= 10n ** 18n) return "—";
  return `${(1 / (1 - Number(maxLtv) / 1e18)).toFixed(2)}x`;
}

function MultiplyRow({ config, cols, showPosition }: { config: MarketConfig; cols: string; showPosition: boolean }) {
  const poll = { refetchInterval: 15_000 };
  const { address } = useAccount();

  const { data: state } = useReadHaltControllerState({ address: config.haltController, query: poll });
  const { data: priceData } = useReadIPausableOracleLatestPrice({ address: config.oracle, query: poll });
  const { data: maxLtv } = useReadMarketMaxLtv({ address: config.market });
  const { data: totalBorrows } = useReadMarketTotalBorrows({ address: config.market, query: poll });
  const { data: cash } = useReadContract({
    address: SHARED.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [config.lenderVault],
    query: poll,
  });

  const rateArgsReady = cash !== undefined && totalBorrows !== undefined;
  const { data: borrowRate } = useReadInterestRateModelGetBorrowRatePerSecond({
    address: SHARED.interestRateModel,
    args: rateArgsReady ? [cash, totalBorrows] : undefined,
    query: { enabled: rateArgsReady, ...poll },
  });

  const { data: position } = useReadMarketGetPosition({
    address: config.market,
    args: address ? [address] : undefined,
    query: { enabled: !!address, ...poll },
  });

  const label = state === undefined ? "OPEN" : (STATE_LABEL[state] ?? "OPEN");
  const halted = label !== "OPEN";

  const collateral = position?.[0] ?? 0n;
  const debt = position?.[1] ?? 0n;
  const hasPosition = collateral > 0n || debt > 0n;
  const leverage = currentLeverage(collateral, debt, priceData?.[0]);

  return (
    <Link
      href={`/app/multiply/${config.key}`}
      className={`grid w-full ${cols} items-center gap-2 rounded-[var(--radius-card)] px-3 py-3 text-left text-xs transition-colors hover:bg-[var(--color-bg-elevated)]`}
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-[var(--color-text)]">{config.name}</span>
        <span className="block truncate text-[10px] text-[var(--color-text-faint)]">{config.symbol}</span>
      </span>

      <span>
        <span className={`inline-block rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold ${STATE_STYLE[label]}`}>
          {label}
        </span>
      </span>

      <span className="font-[family-name:var(--font-display)] text-[var(--color-text)]">
        ${formatPrice(priceData?.[0])}
      </span>

      <span className="text-[var(--color-accent-blue)]">{halted ? "—" : formatApr(borrowRate)}</span>

      <span className="font-[family-name:var(--font-display)] text-[var(--color-text)]">{maxLeverage(maxLtv)}</span>

      {showPosition &&
        (hasPosition ? (
          <span className="min-w-0">
            <span className="block truncate font-[family-name:var(--font-display)] font-semibold text-[var(--color-text)]">
              {leverage ?? formatAmount(collateral, WNVDAX_DECIMALS)}
            </span>
            <span className="block truncate text-[10px] text-[var(--color-text-faint)]">
              {formatAmount(debt, USDG_DECIMALS)} USDG debt
            </span>
          </span>
        ) : (
          <span className="text-[var(--color-text-faint)]">—</span>
        ))}
    </Link>
  );
}

/// Multiply's own market list. Leads with the ceiling each market can actually
/// reach rather than the contract's 5x cap, which no market here gets near.
export function MultiplyMarketsTable() {
  const { isConnected } = useAccount();
  const cols = isConnected ? COLS_WITH_POSITION : COLS;

  return (
    <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Multiply Markets</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">Ceiling derived from each market&apos;s own max LTV</p>
      </div>

      {/* Six columns do not fit a phone, so the table scrolls sideways rather
          than crushing every column to an unreadable width. */}
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className={`grid ${cols} gap-2 px-3 pb-1 text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]`}>
            <span>Asset</span>
            <span>Status</span>
            <span>Price</span>
            <span>Borrow</span>
            <span>Max Leverage</span>
            {isConnected && <span>Your Position</span>}
          </div>

          <div className="space-y-1">
            {MARKETS.map((m) => (
              <MultiplyRow key={m.key} config={m} cols={cols} showPosition={isConnected} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
