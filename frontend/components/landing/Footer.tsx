export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border-subtle)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-[var(--color-text-faint)] sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full bg-[var(--color-accent)]" />
          <span>HaltGate — built on X Layer</span>
        </div>
        <p>Testnet demo. Not financial advice. Not audited for mainnet use.</p>
      </div>
    </footer>
  );
}
