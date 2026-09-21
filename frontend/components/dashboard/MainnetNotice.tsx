"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const KEY = "haltgate.mainnet-notice.seen";

/// sessionStorage is external, mutable, browser-only state, which is exactly
/// what useSyncExternalStore exists for. Reading it in an effect and calling
/// setState would work but causes a cascading render, and reading it during
/// render would desync hydration. The server snapshot returns "seen" so the
/// dialog never appears in prerendered HTML.
function subscribe() {
  return () => {};
}
function seenOnClient() {
  try {
    return sessionStorage.getItem(KEY) !== null;
  } catch {
    return false; // private mode: show it, an extra notice beats a silent one
  }
}
function seenOnServer() {
  return true;
}

/// Shown once per browser session on entering the mainnet view. Session, not
/// permanent: a returning visitor should be reminded that nothing here works,
/// but clicking between markets should not keep interrupting them.
export function MainnetNotice() {
  const alreadySeen = useSyncExternalStore(subscribe, seenOnClient, seenOnServer);
  const [dismissed, setDismissed] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const open = !alreadySeen && !dismissed;

  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function dismiss() {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore: the notice simply shows again on the next navigation */
    }
    setDismissed(true);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mainnet-notice-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-card)] outline-none"
      >
        <p className="text-xs uppercase tracking-wide text-[var(--color-warning)]">X Layer Mainnet</p>
        <h2
          id="mainnet-notice-title"
          className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-text)]"
        >
          Not live yet
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
          HaltGate is not deployed on mainnet. You can browse the real markets, prices and corporate-action data pulled
          live from chain 196, but supplying, borrowing and leverage are all disabled here.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
          Everything works on testnet. Switch back any time using the toggle in the header.
        </p>
        <button
          onClick={dismiss}
          className="mt-5 w-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[var(--color-accent-fg)]"
        >
          Browse mainnet markets
        </button>
      </div>
    </div>
  );
}
