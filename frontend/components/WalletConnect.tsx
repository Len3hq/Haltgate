"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useState, useRef, useEffect } from "react";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isConnected && address) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors"
        >
          <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
          {truncateAddress(address)}
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] py-1 shadow-lg z-50">
            <button
              onClick={() => {
                disconnect();
                setMenuOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-bg-card)]"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setPickerOpen((v) => !v)}
        disabled={isPending}
        className="rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-accent-fg)] hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>
      {pickerOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] py-1 shadow-lg z-50">
          {connectors.length === 0 && (
            <p className="px-4 py-3 text-sm text-[var(--color-text-faint)]">No wallet detected.</p>
          )}
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => {
                connect({ connector });
                setPickerOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-card)]"
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
