"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import {
  useReadMarketTotalBorrows,
  useReadMarketReserveFactor,
  useReadInterestRateModelBaseRatePerSecond,
  useReadInterestRateModelMultiplierPerSecond,
  useReadInterestRateModelJumpMultiplierPerSecond,
  useReadInterestRateModelKink,
} from "@/lib/generated";
import { useMarketContracts } from "@/lib/market-context";


const SECONDS_PER_YEAR = 31_536_000;
const SAMPLES = 41; // resolution for the drawn path only -- exact points are computed in closed form, not interpolated
const VIEW_W = 340;
const VIEW_H = 168;
const PAD_L = 30;
const PAD_R = 8;
const PAD_T = 16;
const PAD_B = 20;

function wadToNumber(v: bigint | undefined): number {
  return v === undefined ? 0 : Number(v) / 1e18;
}

// Mirrors InterestRateModel.getBorrowRatePerSecond/getSupplyRatePerSecond
// exactly (src/core/InterestRateModel.sol), evaluated in closed form for any
// utilization -- used both to draw the curve and to answer "what's the rate
// right here" under the pointer, so hover values are exact, not read off an
// interpolated sample.
function borrowAprAt(util: number, base: number, mult: number, jump: number, kink: number): number {
  const perSecond = util <= kink ? base + util * mult : base + kink * mult + (util - kink) * jump;
  return perSecond * SECONDS_PER_YEAR * 100;
}

function supplyAprAt(util: number, base: number, mult: number, jump: number, kink: number, reserveFactor: number): number {
  const borrowPerSecond = borrowAprAt(util, base, mult, jump, kink) / 100 / SECONDS_PER_YEAR;
  return util * borrowPerSecond * (1 - reserveFactor) * SECONDS_PER_YEAR * 100;
}

/// Kinked borrow/supply rate curve vs. pool utilization. Collapsed by
/// default and scoped to the sidebar rather than the main column -- it's
/// context for the numbers elsewhere on the page, not itself a step in
/// supplying/borrowing/repaying, so it shouldn't sit between the market
/// snapshot and the action panel pushing the actual app down the page.
/// Hand-rolled SVG (matches HealthGauge's existing no-dependency approach)
/// with pointer-driven hover instead of a static render.
export function RateCurveChart() {
  const CONTRACTS = useMarketContracts();
  const [hoverUtil, setHoverUtil] = useState<number | null>(null);

  const { data: baseRaw } = useReadInterestRateModelBaseRatePerSecond({ address: CONTRACTS.interestRateModel });
  const { data: multRaw } = useReadInterestRateModelMultiplierPerSecond({ address: CONTRACTS.interestRateModel });
  const { data: jumpRaw } = useReadInterestRateModelJumpMultiplierPerSecond({ address: CONTRACTS.interestRateModel });
  const { data: kinkRaw } = useReadInterestRateModelKink({ address: CONTRACTS.interestRateModel });
  const { data: reserveFactorRaw } = useReadMarketReserveFactor({ address: CONTRACTS.market });
  const { data: totalBorrows } = useReadMarketTotalBorrows({ address: CONTRACTS.market, query: { refetchInterval: 10_000 } });
  const { data: vaultCash } = useReadContract({
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [CONTRACTS.lenderVault],
    query: { refetchInterval: 10_000 },
  });

  const ready = baseRaw !== undefined && multRaw !== undefined && jumpRaw !== undefined && kinkRaw !== undefined && reserveFactorRaw !== undefined;

  const currentUtil =
    totalBorrows !== undefined && vaultCash !== undefined
      ? totalBorrows === 0n
        ? 0
        : Number(totalBorrows) / Number(vaultCash + totalBorrows)
      : undefined;

  return (
    <details className="group rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Rate Curve</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">How rates move with pool utilization</p>
        </div>
        <div className="flex items-center gap-3">
          {ready && currentUtil !== undefined && (
            <span className="hidden font-[family-name:var(--font-display)] text-xs text-[var(--color-text-muted)] group-open:hidden sm:inline">
              {(currentUtil * 100).toFixed(0)}% util
            </span>
          )}
          <svg
            className="h-4 w-4 shrink-0 text-[var(--color-text-faint)] transition-transform group-open:rotate-180"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
          >
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </summary>

      <div className="border-t border-[var(--color-border-subtle)] p-4 pt-3">
        {!ready ? (
          <div className="h-[168px] animate-pulse rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)]" />
        ) : (
          <RateCurveInner
            base={wadToNumber(baseRaw)}
            mult={wadToNumber(multRaw)}
            jump={wadToNumber(jumpRaw)}
            kink={wadToNumber(kinkRaw)}
            reserveFactor={wadToNumber(reserveFactorRaw)}
            currentUtil={currentUtil}
            hoverUtil={hoverUtil}
            onHover={setHoverUtil}
          />
        )}
      </div>
    </details>
  );
}

function RateCurveInner({
  base,
  mult,
  jump,
  kink,
  reserveFactor,
  currentUtil,
  hoverUtil,
  onHover,
}: {
  base: number;
  mult: number;
  jump: number;
  kink: number;
  reserveFactor: number;
  currentUtil: number | undefined;
  hoverUtil: number | null;
  onHover: (util: number | null) => void;
}) {
  const points = Array.from({ length: SAMPLES }, (_, i) => i / (SAMPLES - 1));
  const borrowCurve = points.map((u) => borrowAprAt(u, base, mult, jump, kink));
  const supplyCurve = points.map((u) => supplyAprAt(u, base, mult, jump, kink, reserveFactor));
  const yMax = Math.max(...borrowCurve, 1) * 1.15;

  const x = (util: number) => PAD_L + util * (VIEW_W - PAD_L - PAD_R);
  const y = (apr: number) => VIEW_H - PAD_B - (apr / yMax) * (VIEW_H - PAD_B - PAD_T);

  const toPath = (curve: number[]) => points.map((u, i) => `${i === 0 ? "M" : "L"}${x(u).toFixed(1)},${y(curve[i]).toFixed(1)}`).join(" ");
  const borrowPath = toPath(borrowCurve);
  const supplyPath = toPath(supplyCurve);
  const borrowArea = `${borrowPath} L${x(1).toFixed(1)},${(VIEW_H - PAD_B).toFixed(1)} L${x(0).toFixed(1)},${(VIEW_H - PAD_B).toFixed(1)} Z`;

  // Hover wins over the live point while active; otherwise the marker shows
  // the market's actual current position -- so the chart always has
  // *something* pinned, never a blank curve with nothing to read.
  const activeUtil = hoverUtil ?? currentUtil;
  const activeBorrowApr = activeUtil !== undefined ? borrowAprAt(activeUtil, base, mult, jump, kink) : undefined;
  const activeSupplyApr = activeUtil !== undefined ? supplyAprAt(activeUtil, base, mult, jump, kink, reserveFactor) : undefined;

  function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const fractionX = (e.clientX - rect.left) / rect.width;
    const svgX = fractionX * VIEW_W;
    const util = (svgX - PAD_L) / (VIEW_W - PAD_L - PAD_R);
    onHover(Math.min(1, Math.max(0, util)));
  }

  // Tooltip box, clamped so it never clips past the chart's own edges.
  const tooltipW = 110;
  const tooltipX = activeUtil !== undefined ? Math.min(Math.max(x(activeUtil) - tooltipW / 2, PAD_L), VIEW_W - PAD_R - tooltipW) : 0;

  return (
    <div>
      <div className="flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1.5 text-[var(--color-accent-blue)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-blue)]" /> Borrow
        </span>
        <span className="flex items-center gap-1.5 text-[var(--color-success)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" /> Supply
        </span>
        <span className="ml-auto text-[var(--color-text-faint)]">Point to explore</span>
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="mt-2 w-full cursor-crosshair touch-none"
        onPointerMove={handlePointer}
        onPointerLeave={() => onHover(null)}
        role="img"
        aria-label={`Borrow and supply interest rates by pool utilization. Currently ${
          currentUtil !== undefined ? (currentUtil * 100).toFixed(1) : "unknown"
        }% utilized.`}
      >
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={PAD_L} x2={VIEW_W - PAD_R} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--color-border-subtle)" strokeWidth={1} />
        ))}

        <line x1={x(kink)} x2={x(kink)} y1={PAD_T} y2={VIEW_H - PAD_B} stroke="var(--color-text-faint)" strokeWidth={1} strokeDasharray="2 3" />
        <text x={x(kink)} y={PAD_T - 5} textAnchor="middle" fontSize={8} fill="var(--color-text-faint)">
          kink {(kink * 100).toFixed(0)}%
        </text>

        <path d={borrowArea} fill="var(--color-accent-blue)" opacity={0.07} />
        <path d={borrowPath} fill="none" stroke="var(--color-accent-blue)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={supplyPath} fill="none" stroke="var(--color-success)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {activeUtil !== undefined && activeBorrowApr !== undefined && activeSupplyApr !== undefined && (
          <g style={{ transition: "transform 80ms ease-out" }}>
            <line x1={x(activeUtil)} x2={x(activeUtil)} y1={PAD_T} y2={VIEW_H - PAD_B} stroke="var(--color-text)" strokeWidth={1} opacity={0.25} />
            <circle cx={x(activeUtil)} cy={y(activeBorrowApr)} r={3.5} fill="var(--color-accent-blue)" stroke="var(--color-bg-card)" strokeWidth={1.5} />
            <circle cx={x(activeUtil)} cy={y(activeSupplyApr)} r={3.5} fill="var(--color-success)" stroke="var(--color-bg-card)" strokeWidth={1.5} />

            <g transform={`translate(${tooltipX}, ${PAD_T - 2})`}>
              <rect width={tooltipW} height={34} rx={5} fill="var(--color-bg-elevated)" stroke="var(--color-border)" strokeWidth={1} />
              <text x={7} y={13} fontSize={9} fill="var(--color-text-muted)">
                {(activeUtil * 100).toFixed(0)}% utilized
              </text>
              <text x={7} y={25} fontSize={9} fontFamily="var(--font-display)" fill="var(--color-accent-blue)">
                B {activeBorrowApr.toFixed(2)}%
              </text>
              <text x={58} y={25} fontSize={9} fontFamily="var(--font-display)" fill="var(--color-success)">
                S {activeSupplyApr.toFixed(2)}%
              </text>
            </g>
          </g>
        )}

        {[0, 1].map((f) => (
          <text key={f} x={PAD_L - 5} y={y(yMax * f)} dy="0.32em" textAnchor="end" fontSize={8} fill="var(--color-text-faint)">
            {(yMax * f).toFixed(0)}%
          </text>
        ))}
        {[0, 1].map((f) => (
          <text key={f} x={x(f)} y={VIEW_H - 6} textAnchor={f === 0 ? "start" : "end"} fontSize={8} fill="var(--color-text-faint)">
            {(f * 100).toFixed(0)}%
          </text>
        ))}
      </svg>

      <p className="mt-2 text-[11px] leading-snug text-[var(--color-text-muted)]">
        Rates hold steady until utilization crosses the kink, then climb sharply -- that jump pulls liquidity back toward safe levels for
        lenders instead of letting the pool run dry.
      </p>
    </div>
  );
}
