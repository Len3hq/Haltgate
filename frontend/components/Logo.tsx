/// The HaltGate mark. Inline SVG rather than an <img> so it scales crisply at
/// any size, adds no network request, and keeps its own brand colours: the
/// green here (#34E08A) is the logo's, deliberately not the UI accent
/// (#BCFF2F), because a brand mark should not be recoloured to match a theme.
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} role="img" aria-label="HaltGate">
      <rect x="14" y="6" width="4" height="4" fill="#34E08A" />
      <rect x="10" y="10" width="4" height="4" fill="#F2F1ED" />
      <rect x="6" y="14" width="4" height="4" fill="#F2F1ED" />
    </svg>
  );
}
