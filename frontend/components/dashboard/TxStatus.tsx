"use client";

import { xLayerTestnet } from "@/lib/chains";
import { getErrorMessage } from "@/lib/errors";

const EXPLORER_TX_BASE = `${xLayerTestnet.blockExplorers.default.url}/tx/`;

type TxStatusProps = {
  hash?: `0x${string}`;
  isPending: boolean; // waiting on the wallet for a signature
  isConfirming: boolean; // signed, waiting for the receipt onchain
  isSuccess: boolean;
  error?: Error | null;
  pendingLabel?: string;
  confirmingLabel?: string;
  successLabel?: string;
};

export function TxStatus({
  hash,
  isPending,
  isConfirming,
  isSuccess,
  error,
  pendingLabel = "Confirm in wallet...",
  confirmingLabel = "Confirming onchain...",
  successLabel = "Confirmed",
}: TxStatusProps) {
  if (error) {
    return <p className="mt-2 text-xs text-[var(--color-error)]">{getErrorMessage(error)}</p>;
  }

  if (!isPending && !isConfirming && !isSuccess) return null;

  const label = isPending ? pendingLabel : isConfirming ? confirmingLabel : successLabel;

  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      {(isPending || isConfirming) && (
        <span
          aria-hidden
          className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]"
        />
      )}
      {isSuccess && !isPending && !isConfirming && (
        <span aria-hidden className="text-[var(--color-success)]">
          ✓
        </span>
      )}
      <span className={isSuccess && !isPending && !isConfirming ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]"}>
        {label}
      </span>
      {hash && (
        <a
          href={`${EXPLORER_TX_BASE}${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-accent)] hover:underline"
        >
          View ↗
        </a>
      )}
    </div>
  );
}
