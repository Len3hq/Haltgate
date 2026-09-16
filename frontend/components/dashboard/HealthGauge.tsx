const MAX_UINT256 = (1n << 256n) - 1n;
const SIZE = 96;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

function healthStatus(hf: number): { label: string; color: string; bg: string } {
  if (hf >= 1.5) return { label: "Safe", color: "var(--color-success)", bg: "var(--color-success-bg)" };
  if (hf >= 1.0) return { label: "Caution", color: "var(--color-warning)", bg: "var(--color-warning-bg)" };
  return { label: "At risk", color: "var(--color-error)", bg: "var(--color-error-bg)" };
}

// Gauge chart per UI Pro Max chart guidance: single KPI vs. a fixed threshold
// (liquidation at 1.00). Text label and number are rendered beside the ring,
// not color-only, per its accessibility notes.
export function HealthGauge({ value }: { value: bigint | undefined }) {
  if (value === undefined) {
    return (
      <div className="flex items-center gap-4">
        <svg width={SIZE} height={SIZE} className="shrink-0 animate-pulse" aria-hidden>
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={STROKE} />
        </svg>
        <div className="h-4 w-16 animate-pulse rounded bg-[var(--color-border)]" />
      </div>
    );
  }

  const noDebt = value === MAX_UINT256;
  const hf = noDebt ? Infinity : Number(value) / 1e18;
  const fraction = noDebt ? 1 : Math.min(hf / 2, 1); // 2.0+ reads as a full ring
  const dashOffset = CIRCUMFERENCE * (1 - fraction);
  const status = noDebt
    ? { label: "No debt", color: "var(--color-text-faint)", bg: "transparent" }
    : healthStatus(hf);
  const display = noDebt ? "∞" : hf.toFixed(2);

  return (
    <div className="flex items-center gap-4">
      <svg
        width={SIZE}
        height={SIZE}
        className="shrink-0"
        role="img"
        aria-label={`Health factor ${noDebt ? "infinite, no debt" : display}, status ${status.label}`}
      >
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={STROKE} />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke={status.color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          style={{ transition: "stroke-dashoffset 500ms ease, stroke 300ms ease" }}
        />
        <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fill="var(--color-text)" fontSize={20} fontWeight={600}>
          {display}
        </text>
      </svg>
      <div>
        <span
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-medium"
          style={{ background: status.bg, color: status.color }}
        >
          {status.label}
        </span>
        <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">Liquidation at 1.00</p>
      </div>
    </div>
  );
}
