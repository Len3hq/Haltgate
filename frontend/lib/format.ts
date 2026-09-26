import { formatUnits } from "viem";

/** Formats a token amount (native decimals) into a compact display string. */
export function formatAmount(value: bigint | undefined, decimals: number, maxFractionDigits = 2): string {
  if (value === undefined) return "--";
  const formatted = Number(formatUnits(value, decimals));
  return formatted.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

/** Formats an 18-decimal WAD fixed-point ratio (e.g. 0.5e18) as a percentage.
 * Keeps up to two decimals so sub-1% values (the settlement bounty) don't
 * round away to "0%", while whole percentages still render clean. */
export function formatBps(value: bigint | undefined): string {
  if (value === undefined) return "--";
  const pct = Number(value) / 1e16;
  return `${Number(pct.toFixed(2))}%`;
}

/** Formats an 18-decimal WAD price as a plain decimal string. */
export function formatPrice(value: bigint | undefined): string {
  if (value === undefined) return "--";
  return Number(formatUnits(value, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Time left until a unix-seconds maturity, given a ticking `now` (useNow). */
export function formatCountdown(maturity: bigint, now: number): string {
  const left = Number(maturity) - now;
  if (left <= 0) return "Matured";
  if (left < 3600) return `${Math.ceil(left / 60)}m left`;
  if (left < 86400) return `${Math.ceil(left / 3600)}h left`;
  return `${Math.ceil(left / 86400)}d left`;
}

const SECONDS_PER_YEAR = 31_536_000n;

/**
 * Formats a per-second WAD rate (InterestRateModel's native units) as a
 * simple (non-compounded) annualized percentage -- APR, not APY. The
 * contracts accrue linear interest between ticks re-anchored to a running
 * index, so the true compounded return is marginally higher than this
 * figure; labeling it APR keeps the display honest about what it is.
 */
export function formatApr(ratePerSecond: bigint | undefined): string {
  if (ratePerSecond === undefined) return "--";
  const annualWad = ratePerSecond * SECONDS_PER_YEAR;
  return `${((Number(annualWad) / 1e18) * 100).toFixed(2)}%`;
}
