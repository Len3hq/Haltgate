import {
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { multisigAbi } from "../testnet/abis";
import { MULTISIG, testnetClient, xLayerTestnet } from "../testnet/markets";

// Every transaction the keeper sends goes through one of these, one at a time.
// Lessons carried over from halt.sh and push_prices.py:
//   * nonces are tracked locally: this RPC's pending-nonce lags a freshly
//     mined tx, and back-to-back sends then fail with "nonce too low"
//   * each send waits for its receipt before the next goes out
//   * the multisig txId comes from the propose() receipt, not from reading
//     transactionCount() first, which races any other proposer

const RETRYABLE = /nonce too low|already known|replacement transaction underpriced|nonce has already been used/i;

export class Signer {
  readonly account;
  private wallet;
  private nonce: number | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(privateKey: string) {
    const pk = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as Hex;
    this.account = privateKeyToAccount(pk);
    this.wallet = createWalletClient({ account: this.account, chain: xLayerTestnet, transport: http() });
  }

  get address() {
    return this.account.address;
  }

  /// Serialises every caller, so two code paths can never interleave nonces.
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  send(to: `0x${string}`, data: Hex, label: string, value = 0n): Promise<TransactionReceipt> {
    return this.enqueue(async () => {
      for (let attempt = 1; ; attempt++) {
        if (this.nonce === null) {
          this.nonce = await testnetClient.getTransactionCount({ address: this.address, blockTag: "pending" });
        }
        try {
          const hash = await this.wallet.sendTransaction({ to, data, value, nonce: this.nonce, type: "legacy" });
          this.nonce += 1;
          const receipt = await testnetClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
          if (receipt.status !== "success") throw new Error(`${label} reverted in tx ${hash}`);
          return receipt;
        } catch (err) {
          const msg = (err as Error).message;
          this.nonce = null; // resync from chain next time, whatever went wrong
          if (RETRYABLE.test(msg) && attempt < 6) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          throw new Error(`${label}: ${msg.split("\n")[0]}`);
        }
      }
    });
  }

  /// Plain OKB transfer, through the same nonce queue.
  transfer(to: `0x${string}`, value: bigint, label: string): Promise<TransactionReceipt> {
    return this.send(to, "0x", label, value);
  }

  /// propose + execute on the 1-of-1 multisig (propose() auto-confirms the
  /// proposer). The inner call is simulated from the multisig first, so a call
  /// that would revert never leaves a dangling proposal behind.
  async viaMultisig(target: `0x${string}`, data: Hex, label: string): Promise<TransactionReceipt> {
    try {
      await testnetClient.call({ account: MULTISIG, to: target, data });
    } catch (err) {
      throw new Error(`${label} would revert: ${(err as Error).message.split("\n")[0]}`);
    }
    const proposed = await this.send(
      MULTISIG,
      encodeFunctionData({ abi: multisigAbi, functionName: "propose", args: [target, 0n, data] }),
      `${label} (propose)`,
    );
    const txId = proposedTxId(proposed);
    return this.send(
      MULTISIG,
      encodeFunctionData({ abi: multisigAbi, functionName: "execute", args: [txId] }),
      `${label} (execute #${txId})`,
    );
  }
}

function proposedTxId(receipt: TransactionReceipt): bigint {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== MULTISIG.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: multisigAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "TransactionProposed") return ev.args.txId;
    } catch {
      // another event from the multisig (TransactionConfirmed)
    }
  }
  throw new Error("propose() receipt has no TransactionProposed event");
}
