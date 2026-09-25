import { createPublicClient, http, type Abi } from "viem";
import { xLayerMainnet } from "../chains";
import type { Reading } from "../types";
import type { Watched } from "../watchlist";

// Read against Backed's BackedAutoFeeTokenImplementation (the implementation
// behind every raw xStock proxy on X Layer; source: github.com/backed-fi/
// backed-token-contract). What the fields mean, from that source:
//
//   newMultiplierActivationTime > block.timestamp  <=>  an update is pending.
//   While pending, multiplier() still returns the OLD value; at the activation
//   second it switches to newMultiplier by itself, with no transaction, because
//   multiplier() is a view that compares against block.timestamp.
//
// Nonces are deliberately not used as the signal: they also move on ordinary
// management-fee periods, which is not a corporate action.
export const xStockAbi = [
  { type: "function", name: "multiplier", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "newMultiplier", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function",
    name: "newMultiplierActivationTime",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "MultiplierScheduled",
    inputs: [
      { name: "newMultiplier", type: "uint256", indexed: false },
      { name: "activationTime", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MultiplierUpdated",
    inputs: [{ name: "value", type: "uint256", indexed: false }],
  },
] as const satisfies Abi;

const multicall3Abi = [
  {
    type: "function",
    name: "getCurrentBlockTimestamp",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const satisfies Abi;

export const mainnetClient = createPublicClient({
  chain: xLayerMainnet,
  transport: http(undefined, { timeout: 20_000, retryCount: 2 }),
});

const WAD = 1e18;
const toFloat = (x: bigint) => Number(x) / WAD;

/// One multicall for every token plus the block timestamp, so "pending" is
/// judged against the same block the values were read from.
export async function readOnchain(watchlist: Watched[]): Promise<Map<string, Reading>> {
  const tokens = watchlist.filter((w): w is Watched & { raw: `0x${string}` } => !!w.raw);
  const out = new Map<string, Reading>();

  const contracts = [
    {
      address: xLayerMainnet.contracts.multicall3.address,
      abi: multicall3Abi,
      functionName: "getCurrentBlockTimestamp",
    } as const,
    ...tokens.flatMap((t) =>
      (["multiplier", "newMultiplier", "newMultiplierActivationTime"] as const).map(
        (functionName) => ({ address: t.raw, abi: xStockAbi, functionName }) as const,
      ),
    ),
  ];

  let results;
  try {
    results = await mainnetClient.multicall({ contracts, allowFailure: true });
  } catch (err) {
    const error = `multicall failed: ${(err as Error).message.split("\n")[0]}`;
    for (const t of tokens) out.set(t.ticker, { ok: false, error });
    return out;
  }

  const [tsResult, ...rest] = results;
  if (tsResult.status !== "success") {
    for (const t of tokens) out.set(t.ticker, { ok: false, error: "block timestamp read failed" });
    return out;
  }
  const blockTs = Number(tsResult.result as bigint);

  tokens.forEach((t, i) => {
    const [cur, next, activation] = rest.slice(i * 3, i * 3 + 3);
    if (cur.status !== "success" || next.status !== "success" || activation.status !== "success") {
      out.set(t.ticker, { ok: false, error: "token read reverted" });
      return;
    }
    const activationTime = Number(activation.result as bigint);
    const pending = activationTime > blockTs;
    out.set(t.ticker, {
      ok: true,
      pending,
      activationTime: activationTime > 0 ? activationTime : null,
      newMultiplier: pending ? toFloat(next.result as bigint) : null,
      currentMultiplier: toFloat(cur.result as bigint),
      reason: null,
    });
  });
  return out;
}
