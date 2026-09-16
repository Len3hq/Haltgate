import { WalletConnect } from "./WalletConnect";

export function Header() {
  return (
    <header className="border-b border-[var(--color-border-subtle)]">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-[var(--color-accent)]" />
          <span className="text-lg font-semibold tracking-tight">HaltGate</span>
        </div>
        <WalletConnect />
      </div>
    </header>
  );
}
