"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain, type Connector } from "wagmi";
import { formatUnits } from "viem";
import { xLayerTestnet } from "@/lib/chains";
import { Logo } from "@/components/Logo";

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/// Deterministic two-tone avatar from the address, so each wallet gets a
/// recognisable mark without pulling in an identicon library.
function Avatar({ address, size = 20 }: { address: string; size?: number }) {
  const a = parseInt(address.slice(2, 8), 16) % 360;
  const b = (a + 140) % 360;
  return (
    <span
      aria-hidden
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(from 90deg, hsl(${a} 70% 55%), hsl(${b} 70% 45%), hsl(${a} 70% 55%))`,
      }}
    />
  );
}

/// With EIP-6963 discovery every installed wallet announces itself, and the
/// generic injected() connector is registered too. It duplicates whichever
/// wallet owns window.ethereum when one exists, and when none does it is still
/// listed, which previously made the modal claim a wallet was "Detected" on a
/// browser with no wallet at all. So: announced wallets first; the generic one
/// only if a provider genuinely exists; otherwise nothing, and the install
/// prompt shows. Only ever called client-side, after a click.
function visibleConnectors(connectors: readonly Connector[]) {
  const announced = connectors.filter((c) => c.id !== "injected");
  if (announced.length > 0) return announced;
  const hasProvider = typeof window !== "undefined" && "ethereum" in window && !!window.ethereum;
  return hasProvider ? connectors : [];
}

function displayName(c: Connector) {
  return c.id === "injected" ? "Browser wallet" : c.name;
}

const INSTALL = [
  { name: "OKX Wallet", href: "https://www.okx.com/web3" },
  { name: "MetaMask", href: "https://metamask.io/download/" },
];

function ConnectModal({ onClose }: { onClose: () => void }) {
  const { connectors, connect, isPending, variables, error, reset } = useConnect();
  const panel = useRef<HTMLDivElement>(null);
  const list = visibleConnectors(connectors);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pendingId = isPending && variables && "uid" in variables.connector ? variables.connector.uid : undefined;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)] outline-none"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Logo className="h-5 w-5" />
            <h2 id="connect-title" className="font-[family-name:var(--font-display)] text-base font-semibold">
              Connect a wallet
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-faint)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]"
          >
            ✕
          </button>
        </div>

        <div className="p-3">
          {list.length === 0 ? (
            <div className="px-2 py-3">
              <p className="text-sm text-[var(--color-text)]">No wallet detected</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Install one, then refresh this page.</p>
              <div className="mt-3 space-y-1.5">
                {INSTALL.map((w) => (
                  <a
                    key={w.name}
                    href={w.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2.5 text-sm transition-colors hover:border-[var(--color-accent)]"
                  >
                    {w.name}
                    <span className="text-xs text-[var(--color-text-faint)]">Install ↗</span>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-1">
              {list.map((c) => {
                const pending = pendingId === c.uid;
                return (
                  <li key={c.uid}>
                    <button
                      onClick={() => {
                        reset();
                        connect({ connector: c }, { onSuccess: onClose });
                      }}
                      disabled={isPending}
                      className="flex w-full items-center gap-3 rounded-[var(--radius-card)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-elevated)] disabled:cursor-wait"
                    >
                      {c.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element -- data: URI from the wallet itself
                        <img src={c.icon} alt="" className="h-8 w-8 shrink-0 rounded-lg" />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)] text-xs font-semibold text-[var(--color-text-muted)]">
                          {displayName(c).slice(0, 1)}
                        </span>
                      )}
                      <span className="flex-1 text-sm font-medium text-[var(--color-text)]">{displayName(c)}</span>
                      <span
                        className={`text-[11px] ${pending ? "text-[var(--color-accent)]" : "text-[var(--color-text-faint)]"}`}
                      >
                        {pending ? "Check wallet…" : "Detected"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {error && (
            <p className="mx-1 mt-3 rounded-[var(--radius-card)] bg-[var(--color-error-bg)] px-3 py-2 text-xs text-[var(--color-error)]">
              {error.name === "UserRejectedRequestError" ? "Request rejected in wallet." : error.message.split("\n")[0]}
            </p>
          )}
        </div>

        <p className="border-t border-[var(--color-border-subtle)] px-5 py-3 text-[11px] leading-relaxed text-[var(--color-text-faint)]">
          HaltGate runs on X Layer testnet. Your wallet will be asked to switch network if needed.
        </p>
      </div>
    </div>
  );
}

function AccountMenu({ address, onClose }: { address: `0x${string}`; onClose: () => void }) {
  const { chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { data: balance } = useBalance({ address, chainId: xLayerTestnet.id });
  const [copied, setCopied] = useState(false);
  const wrongNetwork = chainId !== xLayerTestnet.id;

  function copy() {
    navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 px-4 py-4">
        <Avatar address={address} size={36} />
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-text)]">
            {truncate(address)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {balance ? `${Number(formatUnits(balance.value, balance.decimals)).toFixed(4)} OKB` : "…"}
          </p>
        </div>
      </div>

      <div className="border-t border-[var(--color-border-subtle)] px-4 py-3">
        {wrongNetwork ? (
          <button
            onClick={() => switchChain({ chainId: xLayerTestnet.id })}
            disabled={switching}
            className="flex w-full items-center justify-between rounded-[var(--radius-card)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs font-medium text-[var(--color-warning)] disabled:opacity-60"
          >
            Wrong network
            <span>{switching ? "Switching…" : "Switch to X Layer →"}</span>
          </button>
        ) : (
          <p className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
            X Layer Testnet
          </p>
        )}
      </div>

      <div className="border-t border-[var(--color-border-subtle)] p-1.5">
        <button
          onClick={copy}
          className="flex w-full items-center justify-between rounded-[var(--radius-card)] px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-elevated)]"
        >
          Copy address
          <span className="text-xs text-[var(--color-text-faint)]">{copied ? "Copied" : ""}</span>
        </button>
        <a
          href={`${xLayerTestnet.blockExplorers.default.url}/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="flex w-full items-center justify-between rounded-[var(--radius-card)] px-3 py-2 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-elevated)]"
        >
          View on OKLink
          <span className="text-xs text-[var(--color-text-faint)]">↗</span>
        </a>
        <button
          onClick={() => {
            disconnect();
            onClose();
          }}
          className="w-full rounded-[var(--radius-card)] px-3 py-2 text-left text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

export function WalletConnect() {
  const { address, isConnected, chainId } = useAccount();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Stable identity: the modal's focus/keydown effect depends on it, and an
  // inline arrow would re-run that effect and steal focus on every render.
  const closeModal = useCallback(() => setModalOpen(false), []);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (isConnected && address) {
    const wrongNetwork = chainId !== xLayerTestnet.id;
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          className={`flex items-center gap-2 rounded-[var(--radius-pill)] border bg-[var(--color-bg-card)] py-1.5 pl-1.5 pr-3 text-sm font-medium text-[var(--color-text)] transition-colors ${
            wrongNetwork
              ? "border-[var(--color-warning)]"
              : "border-[var(--color-border)] hover:border-[var(--color-text-faint)]"
          }`}
        >
          <Avatar address={address} />
          {truncate(address)}
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            className={`h-4 w-4 text-[var(--color-text-faint)] transition-transform ${menuOpen ? "rotate-180" : ""}`}
          >
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {menuOpen && <AccountMenu address={address} onClose={() => setMenuOpen(false)} />}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-accent-fg)] transition-opacity hover:opacity-90"
      >
        Connect Wallet
      </button>
      {/* Portalled to <body>: the header uses backdrop-filter, which makes it
          the containing block for fixed descendants, so a modal rendered in
          place would be trapped inside the header instead of the viewport. */}
      {modalOpen && createPortal(<ConnectModal onClose={closeModal} />, document.body)}
    </>
  );
}
