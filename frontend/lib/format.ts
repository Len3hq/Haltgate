import { formatUnits } from "viem";

/** Formats a token amount (native decimals) into a compact display string. */
export function formatAmount(value: bigint | undefined, decimals: number, maxFractionDigits = 2): string {
  if (value === undefined) return "--";
  const formatted = Number(formatUnits(value, decimals));
  return formatted.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

/** Formats an 18-decimal WAD fixed-point ratio (e.g. 0.5e18) as a percentage. */
export function formatBps(value: bigint | undefined): string {
  if (value === undefined) return "--";
  return `${(Number(value) / 1e16).toFixed(0)}%`;
}

/** Formats an 18-decimal WAD price as a plain decimal string. */
export function formatPrice(value: bigint | undefined): string {
  if (value === undefined) return "--";
  return Number(formatUnits(value, 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
