"use client";

/// Hover/focus explainer. Uses a named group so it never collides with the
/// `group-open:` classes the collapsible cards rely on.
export function InfoTip({ text, align = "center" }: { text: string; align?: "center" | "left" | "right" }) {
  const pos =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <span className="group/tip relative inline-flex items-center align-middle">
      <button
        type="button"
        aria-label={text}
        className="ml-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--color-border)] text-[9px] leading-none text-[var(--color-text-faint)] transition-colors hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-muted)]"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-50 mt-1.5 hidden w-56 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-2 text-[11px] font-normal leading-snug text-[var(--color-text-muted)] shadow-[var(--shadow-card)] group-hover/tip:block group-focus-within/tip:block ${pos}`}
      >
        {text}
      </span>
    </span>
  );
}
