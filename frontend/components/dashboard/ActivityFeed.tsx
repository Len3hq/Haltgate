"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import type { GetContractEventsReturnType } from "viem";
import {
  marketAbi,
  useWatchMarketSuppliedEvent,
  useWatchMarketWithdrawnEvent,
  useWatchMarketBorrowedEvent,
  useWatchMarketRepaidEvent,
  useWatchMarketLiquidatedEvent,
} from "@/lib/generated";
import { USDG_DECIMALS, WNVDAX_DECIMALS } from "@/lib/contracts";
import { formatAmount } from "@/lib/format";
import { xLayerTestnet } from "@/lib/chains";
import { useMarketContracts } from "@/lib/market-context";

type Kind = "Supply" | "Withdraw" | "Borrow" | "Repay" | "Liquidate";

type Item = {
  key: string;
  kind: Kind;
  user: `0x${string}`;
  amount: bigint;
  decimals: number;
  token: "wNVDAx" | "USDG";
  txHash: `0x${string}`;
  blockNumber: bigint;
};

const KIND_STYLE: Record<Kind, string> = {
  Supply: "text-[var(--color-success)]",
  Withdraw: "text-[var(--color-text-muted)]",
  Borrow: "text-[var(--color-accent-blue)]",
  Repay: "text-[var(--color-success)]",
  Liquidate: "text-[var(--color-error)]",
};

// X Layer testnet's public RPC rejects eth_getLogs ranges over 100 blocks
// ("block range greater than 100 max") -- confirmed by hitting it directly.
// Requesting history has to be chunked into windows this small.
const MAX_LOG_RANGE = 100n;
const HISTORY_BLOCK_WINDOW = 1_000n; // ~10 chunked requests; recent-enough without hammering the RPC
const MAX_ITEMS = 12;

function truncate(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type MarketLog = GetContractEventsReturnType<typeof marketAbi>[number];
type PublicClient = NonNullable<ReturnType<typeof usePublicClient>>;

function toItem(log: MarketLog): Item | null {
  const key = `${log.transactionHash}-${log.logIndex}`;
  const base = { key, txHash: log.transactionHash!, blockNumber: log.blockNumber! };
  switch (log.eventName) {
    case "Supplied":
      return { ...base, kind: "Supply", user: log.args.user!, amount: log.args.amount!, decimals: WNVDAX_DECIMALS, token: "wNVDAx" };
    case "Withdrawn":
      return { ...base, kind: "Withdraw", user: log.args.user!, amount: log.args.amount!, decimals: WNVDAX_DECIMALS, token: "wNVDAx" };
    case "Borrowed":
      return { ...base, kind: "Borrow", user: log.args.user!, amount: log.args.amount!, decimals: USDG_DECIMALS, token: "USDG" };
    case "Repaid":
      return { ...base, kind: "Repay", user: log.args.user!, amount: log.args.amount!, decimals: USDG_DECIMALS, token: "USDG" };
    case "Liquidated":
      return { ...base, kind: "Liquidate", user: log.args.user!, amount: log.args.debtRepaid!, decimals: USDG_DECIMALS, token: "USDG" };
    default:
      return null;
  }
}

async function fetchHistory(client: PublicClient, market: `0x${string}`, fromBlock: bigint, toBlock: bigint): Promise<MarketLog[]> {
  const chunks: Promise<MarketLog[]>[] = [];
  for (let start = fromBlock; start <= toBlock; start += MAX_LOG_RANGE + 1n) {
    const end = start + MAX_LOG_RANGE > toBlock ? toBlock : start + MAX_LOG_RANGE;
    chunks.push(
      client.getContractEvents({ address: market, abi: marketAbi, fromBlock: start, toBlock: end }).catch(() => [])
    );
  }
  const results = await Promise.all(chunks);
  return results.flat();
}

export function ActivityFeed() {
  const CONTRACTS = useMarketContracts();
  const publicClient = usePublicClient();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    setItems(null);

    async function loadHistory() {
      const latest = await publicClient!.getBlockNumber();
      const fromBlock = latest > HISTORY_BLOCK_WINDOW ? latest - HISTORY_BLOCK_WINDOW : 0n;
      const logs = await fetchHistory(publicClient!, CONTRACTS.market, fromBlock, latest);
      if (cancelled) return;

      const mapped = logs
        .map(toItem)
        .filter((item): item is Item => item !== null)
        .sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : -1));

      setItems(mapped.slice(0, MAX_ITEMS));
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
    // Re-fetches when the selected market changes -- history is per-market.
  }, [publicClient, CONTRACTS.market]);

  function prepend(item: Item) {
    setItems((prev) => [item, ...(prev ?? [])].slice(0, MAX_ITEMS));
  }

  useWatchMarketSuppliedEvent({
    address: CONTRACTS.market,
    onLogs: (logs) =>
      logs.forEach((l) =>
        prepend({ key: `${l.transactionHash}-${l.logIndex}`, kind: "Supply", user: l.args.user!, amount: l.args.amount!, decimals: WNVDAX_DECIMALS, token: "wNVDAx", txHash: l.transactionHash!, blockNumber: l.blockNumber! })
      ),
  });
  useWatchMarketWithdrawnEvent({
    address: CONTRACTS.market,
    onLogs: (logs) =>
      logs.forEach((l) =>
        prepend({ key: `${l.transactionHash}-${l.logIndex}`, kind: "Withdraw", user: l.args.user!, amount: l.args.amount!, decimals: WNVDAX_DECIMALS, token: "wNVDAx", txHash: l.transactionHash!, blockNumber: l.blockNumber! })
      ),
  });
  useWatchMarketBorrowedEvent({
    address: CONTRACTS.market,
    onLogs: (logs) =>
      logs.forEach((l) =>
        prepend({ key: `${l.transactionHash}-${l.logIndex}`, kind: "Borrow", user: l.args.user!, amount: l.args.amount!, decimals: USDG_DECIMALS, token: "USDG", txHash: l.transactionHash!, blockNumber: l.blockNumber! })
      ),
  });
  useWatchMarketRepaidEvent({
    address: CONTRACTS.market,
    onLogs: (logs) =>
      logs.forEach((l) =>
        prepend({ key: `${l.transactionHash}-${l.logIndex}`, kind: "Repay", user: l.args.user!, amount: l.args.amount!, decimals: USDG_DECIMALS, token: "USDG", txHash: l.transactionHash!, blockNumber: l.blockNumber! })
      ),
  });
  useWatchMarketLiquidatedEvent({
    address: CONTRACTS.market,
    onLogs: (logs) =>
      logs.forEach((l) =>
        prepend({ key: `${l.transactionHash}-${l.logIndex}`, kind: "Liquidate", user: l.args.user!, amount: l.args.debtRepaid!, decimals: USDG_DECIMALS, token: "USDG", txHash: l.transactionHash!, blockNumber: l.blockNumber! })
      ),
  });

  return (
    <div className="rounded-[var(--radius-card-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Recent Activity</p>

      {items === null ? (
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-bg-elevated)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">No activity in the last ~1,000 blocks.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {items.map((item) => (
            <li key={item.key}>
              <a
                href={`${xLayerTestnet.blockExplorers.default.url}/tx/${item.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-[var(--radius-card)] px-2 py-2 text-sm transition-colors hover:bg-[var(--color-bg-elevated)]"
              >
                <span className="flex items-center gap-2">
                  <span className={`font-medium ${KIND_STYLE[item.kind]}`}>{item.kind}</span>
                  <span className="text-[var(--color-text-faint)]">{truncate(item.user)}</span>
                </span>
                <span className="text-[var(--color-text-muted)]">
                  {formatAmount(item.amount, item.decimals)} {item.token}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
