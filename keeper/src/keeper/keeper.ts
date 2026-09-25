import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { encodeFunctionData, formatEther, type Hex } from "viem";
import { sendText } from "../alert";
import { config } from "../config";
import type { State, TickerState } from "../types";
import { haltControllerAbi, multisigAbi, oracleAbi } from "../testnet/abis";
import {
  HaltState,
  MULTISIG,
  buildKeeperMarkets,
  readMarkets,
  testnetClient,
  type KeeperMarket,
  type MarketChain,
} from "../testnet/markets";
import { decide, type ActionInfo, type HaltRecord, type Note, type Signal, type Step } from "./policy";
import { fetchQuoteWad, formatWad, planPush } from "./prices";
import { Signer } from "./signer";

type Persisted = {
  version: 1;
  records: Record<string, HaltRecord>;
  /// market key -> simulated activation time. Kept across restarts so a
  /// redeploy mid-simulation doesn't shift the timeline.
  simulations: Record<string, number>;
};

type MarketStatus = {
  chain: (Omit<MarketChain, "price" | "state"> & { state: string; price: string }) | { error: string } | null;
  signal: Signal | null;
  record: HaltRecord | null;
  lastSteps: { at: number; steps: Step[]; ok: boolean; error?: string } | null;
};

const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));

export class Keeper {
  private persisted: Persisted = { version: 1, records: {}, simulations: {} };
  private seenNotes = new Map<string, Set<string>>();
  private status: Record<string, MarketStatus> = {};
  private lastPricePassAt = 0;
  private lastState = new Map<string, HaltState>();
  private gasOkb: number | null = null;
  private tickHealth: { lastOkAt: number | null; lastError: string | null } = { lastOkAt: null, lastError: null };

  private constructor(
    readonly mode: "dry-run" | "live",
    private markets: KeeperMarket[],
    private signer: Signer | null,
    private appendEvents: (events: Array<{ at: number; type: string; [k: string]: unknown }>) => Promise<void>,
  ) {
    for (const m of markets) this.status[m.key] = { chain: null, signal: null, record: null, lastSteps: null };
  }

  private get statePath() {
    return join(config.dataDir, "keeper.json");
  }

  static async create(opts: {
    mode: "dry-run" | "live";
    simulate: Array<{ market: string; inSec: number }>;
    appendEvents: Keeper["appendEvents"];
  }): Promise<Keeper> {
    let markets = buildKeeperMarkets(config.keeperMarkets);
    let signer: Signer | null = null;

    if (opts.mode === "live") {
      if (!config.keeperPrivateKey) throw new Error("KEEPER_MODE=live needs KEEPER_PRIVATE_KEY");
      if (!config.finnhubApiKey) throw new Error("KEEPER_MODE=live needs FINNHUB_API_KEY (the resume price)");
      signer = new Signer(config.keeperPrivateKey);
      markets = await authorisedMarkets(markets, signer.address);
    }

    const k = new Keeper(opts.mode, markets, signer, opts.appendEvents);
    await k.load();
    const now = Math.floor(Date.now() / 1000);
    for (const s of opts.simulate) {
      if (!markets.some((m) => m.key === s.market)) throw new Error(`--simulate: unknown or excluded market "${s.market}"`);
      // An existing simulation wins: restarting with the same flag must not
      // push the activation time back out.
      k.persisted.simulations[s.market] ??= now + s.inSec;
      log("simulation armed", {
        market: s.market,
        activation: new Date(k.persisted.simulations[s.market] * 1000).toISOString(),
      });
    }
    await k.save();

    log("keeper ready", {
      mode: opts.mode,
      signer: signer?.address ?? null,
      markets: markets.map((m) => `${m.key}<-${m.ticker}`),
      windows: {
        haltingLeadSec: config.haltingLeadSec,
        haltBufferSec: config.haltBufferSec,
        resumeCooldownSec: config.resumeCooldownSec,
      },
      pricePush: config.pricePush,
    });
    return k;
  }

  private async load() {
    if (this.mode !== "live") return; // dry-run never persists, so it can't pollute live state
    try {
      const p = JSON.parse(await readFile(this.statePath, "utf8")) as Persisted;
      if (p.version === 1) this.persisted = p;
    } catch {
      // first run
    }
  }

  private async save() {
    if (this.mode !== "live") return;
    const tmp = `${this.statePath}.tmp`;
    await writeFile(tmp, JSON.stringify(this.persisted, null, 2));
    await rename(tmp, this.statePath);
  }

  private signalFor(m: KeeperMarket, t: TickerState | undefined, now: number): Signal {
    const onchain = t?.onchain;
    const api = t?.api;
    const live = (s: typeof onchain) => (s?.lastReading?.ok ? s.lastReading.currentMultiplier : null);
    const currentMultiplier = live(onchain) ?? live(api);

    const sim = this.persisted.simulations[m.key];
    if (sim !== undefined) {
      return {
        pending: now < sim ? { activationTime: sim, newMultiplier: null, reason: "Simulated", source: "simulated" } : null,
        currentMultiplier,
        allSourcesOk: true,
      };
    }

    const candidates: ActionInfo[] = [];
    for (const [source, s] of [["onchain", onchain], ["api", api]] as const) {
      if (s?.pending) {
        candidates.push({
          activationTime: s.pending.activationTime,
          newMultiplier: s.pending.newMultiplier,
          reason: s.pending.reason,
          source,
        });
      }
    }
    // Disagreeing sources: act on the earlier one. A false halt is cheap, a
    // missed one is not.
    candidates.sort((a, b) => a.activationTime - b.activationTime);
    const pending = candidates[0] ?? null;
    if (pending && !pending.reason) pending.reason = api?.pending?.reason ?? null;

    const watched = [onchain, api].filter((s) => s !== undefined);
    const allSourcesOk = watched.length > 0 && watched.every((s) => !s!.down && s!.lastReading?.ok);
    return { pending, currentMultiplier, allSourcesOk };
  }

  /// One pass over every market. Called right after the watcher's tick.
  async tick(watcher: State, now: number) {
    try {
      await this.tickInner(watcher, now);
      this.tickHealth = { lastOkAt: now, lastError: null };
    } catch (err) {
      this.tickHealth.lastError = (err as Error).message;
      throw err;
    }
  }

  private async tickInner(watcher: State, now: number) {
    const chains = await readMarkets(this.markets);
    if (this.signer) await this.checkGas();

    for (const m of this.markets) {
      const chain = chains.get(m.key)!;
      const st = this.status[m.key];
      if (chain instanceof Error) {
        st.chain = { error: chain.message };
        await this.note(m, { key: `read-failed`, level: "warn", text: `testnet read failed: ${chain.message}` });
        continue;
      }
      this.clearNote(m, "read-failed");
      st.chain = { ...chain, state: HaltState[chain.state], price: formatWad(chain.price) };

      // Every transition, whoever caused it: the keeper, halt.sh, a stranger
      // calling the permissionless sync(), or forceSettle().
      const prev = this.lastState.get(m.key);
      if (prev !== undefined && prev !== chain.state) {
        await this.note(m, {
          key: `state:${prev}:${chain.state}:${now}`,
          level: chain.state === HaltState.SETTLING ? "warn" : "info",
          text: `state ${HaltState[prev]} → ${HaltState[chain.state]}`,
        });
      }
      this.lastState.set(m.key, chain.state);

      const signal = this.signalFor(m, watcher.tickers[m.ticker], now);
      st.signal = signal;
      const record = this.persisted.records[m.key] ?? null;
      const d = decide(chain, signal, record, now, config);

      for (const n of d.notes) await this.note(m, n);

      let ok = true;
      if (d.steps.length > 0) {
        ok = await this.execute(m, d.steps, now);
      }
      if (ok) {
        if (d.record) this.persisted.records[m.key] = d.record;
        else delete this.persisted.records[m.key];
        // A simulation ends once its cycle does.
        const sim = this.persisted.simulations[m.key];
        if (sim !== undefined && !d.record && now >= sim) delete this.persisted.simulations[m.key];
      }
      st.record = this.persisted.records[m.key] ?? null;
    }
    await this.save();

    if (config.pricePush && now * 1000 - this.lastPricePassAt >= config.priceIntervalMs) {
      this.lastPricePassAt = now * 1000;
      await this.pricePass();
    }
  }

  private async execute(m: KeeperMarket, steps: Step[], now: number): Promise<boolean> {
    const st = this.status[m.key];
    log(this.mode === "live" ? "executing" : "would execute", { market: m.key, steps });

    for (const step of steps) {
      try {
        const detail = await this.run(m, step);
        await this.appendEvents([{ at: now, type: "keeper-step", market: m.key, step, mode: this.mode, ...detail }]);
        if (this.mode === "live") {
          await sendText([`⚙️ ${m.name}: ${step}${detail.price ? ` at $${detail.price}` : ""} ✓`]);
        }
      } catch (err) {
        const error = (err as Error).message;
        st.lastSteps = { at: now, steps, ok: false, error };
        await this.appendEvents([{ at: now, type: "keeper-step-failed", market: m.key, step, error }]);
        await this.note(m, { key: `fail:${step}:${error}`, level: "warn", text: `${step} failed: ${error}` });
        return false;
      }
    }
    st.lastSteps = { at: now, steps, ok: true };
    return true;
  }

  /// One step. In dry-run, everything up to the send: the resume price is
  /// still fetched, so the plan shows the real number.
  private async run(m: KeeperMarket, step: Step): Promise<{ tx?: string; price?: string }> {
    const hc = (fn: "beginHalting" | "sync" | "completeResume") =>
      encodeFunctionData({ abi: haltControllerAbi, functionName: fn });

    let price: bigint | undefined;
    if (step === "resumeOracle") {
      try {
        price = await fetchQuoteWad(m.ticker);
      } catch (err) {
        if (this.mode === "live") throw err;
        log("dry-run: no quote for resume price", { market: m.key, error: (err as Error).message });
      }
    }
    if (this.mode !== "live") {
      log("dry-run step", { market: m.key, step, price: price !== undefined ? formatWad(price) : undefined });
      return { price: price !== undefined ? formatWad(price) : undefined };
    }

    const s = this.signer!;
    let receipt;
    switch (step) {
      case "beginHalting":
      case "sync":
      case "completeResume":
        receipt = await s.send(m.haltController, hc(step), `${m.key} ${step}`);
        break;
      case "pauseOracle":
        receipt = await s.viaMultisig(
          m.oracle,
          encodeFunctionData({ abi: oracleAbi, functionName: "pauseOracle" }),
          `${m.key} pauseOracle`,
        );
        break;
      case "resumeOracle":
        receipt = await s.viaMultisig(
          m.oracle,
          encodeFunctionData({ abi: oracleAbi, functionName: "resumeOracle", args: [price!] }),
          `${m.key} resumeOracle`,
        );
        break;
    }
    log("step done", { market: m.key, step, tx: receipt.transactionHash });
    return { tx: receipt.transactionHash, price: price !== undefined ? formatWad(price) : undefined };
  }

  /// Port of push_prices.py: real quotes into the mock oracles, stepped at the
  /// oracle's deviation cap, skipping any that are paused.
  private async pricePass() {
    const chains = await readMarkets(this.markets);
    for (const m of this.markets) {
      const chain = chains.get(m.key)!;
      if (chain instanceof Error) continue;
      try {
        const [target, maxBps] = await Promise.all([
          fetchQuoteWad(m.ticker),
          testnetClient.readContract({ address: m.oracle, abi: oracleAbi, functionName: "maxNormalUpdateDeviationBps" }),
        ]);
        const plan = planPush({
          current: chain.price,
          updatedAt: chain.priceUpdatedAt,
          paused: chain.oraclePaused,
          target,
          maxBps,
          chainNow: chain.blockTs,
          refreshAfterSec: config.priceRefreshAfterSec,
        });
        log("price", {
          market: m.key,
          onChain: formatWad(chain.price),
          target: formatWad(target),
          push: plan.push !== null ? formatWad(plan.push) : null,
          reason: plan.reason,
          mode: this.mode,
        });
        if (plan.push === null || this.mode !== "live") continue;
        const data: Hex = encodeFunctionData({ abi: oracleAbi, functionName: "setPrice", args: [plan.push] });
        await this.signer!.viaMultisig(m.oracle, data, `${m.key} setPrice`);
      } catch (err) {
        log("price push failed", { market: m.key, error: (err as Error).message });
      }
    }
  }

  /// Each distinct note is logged and alerted once per market, not every tick.
  private async note(m: KeeperMarket, n: Note) {
    const seen = this.seenNotes.get(m.key) ?? new Set<string>();
    this.seenNotes.set(m.key, seen);
    if (seen.has(n.key)) return;
    seen.add(n.key);
    log(n.level === "warn" ? "keeper warning" : "keeper note", { market: m.key, text: n.text });
    await sendText([`${n.level === "warn" ? "⚠️" : "ℹ️"} ${m.name}: ${n.text}`]);
  }

  private clearNote(m: KeeperMarket, key: string) {
    this.seenNotes.get(m.key)?.delete(key);
  }

  private async checkGas() {
    try {
      const wei = await testnetClient.getBalance({ address: this.signer!.address });
      this.gasOkb = Number(formatEther(wei));
    } catch {
      return; // a failed balance read is not a low balance
    }
    // Not about any one market: filed under a keeper-wide label for alerts.
    const all = { key: "_keeper", name: "Keeper" } as KeeperMarket;
    if (this.gasOkb < config.minGasBalanceOkb) {
      await this.note(all, {
        key: "gas-low",
        level: "warn",
        text: `keeper ${this.signer!.address} has ${this.gasOkb.toFixed(4)} OKB, below ${config.minGasBalanceOkb}. Top it up (web3.okx.com/xlayer/faucet)`,
      });
    } else {
      this.clearNote(all, "gas-low");
    }
  }

  health() {
    return { mode: this.mode, ...this.tickHealth, gasOkb: this.gasOkb, gasLow: this.gasOkb !== null && this.gasOkb < config.minGasBalanceOkb };
  }

  /// What the frontend shows: per market, the action being tracked (the
  /// keeper's own halt, else the next scheduled one) and when each step of
  /// the timeline will happen. Public and read-only.
  schedule() {
    return this.markets.map((m) => {
      const st = this.status[m.key];
      const a = st.record ?? st.signal?.pending ?? null;
      const T = a?.activationTime;
      return {
        market: m.key,
        name: m.name,
        ticker: m.ticker,
        state: st.chain && "state" in st.chain ? st.chain.state : null,
        action:
          a && T !== undefined
            ? {
                reason: a.reason,
                source: a.source,
                activationTime: T,
                haltingAt: T - config.haltingLeadSec,
                haltedAt: T - config.haltBufferSec,
                resumeFrom: T + config.haltBufferSec,
                reopenFrom: T + config.haltBufferSec + config.resumeCooldownSec,
                cancelled: st.record?.cancelled ?? false,
              }
            : null,
      };
    });
  }

  snapshot() {
    return {
      mode: this.mode,
      health: this.health(),
      signer: this.signer?.address ?? null,
      simulations: this.persisted.simulations,
      markets: this.status,
    };
  }
}

/// Live mode only acts on markets this key can actually drive: it must be the
/// HaltController's keeper (or owner), and a signer on a 1-of-1 multisig,
/// since propose+execute from one key is the whole ceremony.
async function authorisedMarkets(markets: KeeperMarket[], who: `0x${string}`): Promise<KeeperMarket[]> {
  const [isSigner, threshold] = await Promise.all([
    testnetClient.readContract({ address: MULTISIG, abi: multisigAbi, functionName: "isSigner", args: [who] }),
    testnetClient.readContract({ address: MULTISIG, abi: multisigAbi, functionName: "threshold" }),
  ]);
  if (!isSigner) throw new Error(`${who} is not a signer on the multisig ${MULTISIG}; it cannot pause or resume oracles`);
  if (threshold !== 1n) throw new Error(`multisig threshold is ${threshold}; the keeper needs 1-of-1 to propose and execute alone`);

  const ok: KeeperMarket[] = [];
  for (const m of markets) {
    const [keeper, owner] = await Promise.all([
      testnetClient.readContract({ address: m.haltController, abi: haltControllerAbi, functionName: "keeper" }),
      testnetClient.readContract({ address: m.haltController, abi: haltControllerAbi, functionName: "owner" }),
    ]);
    if ([keeper, owner].some((a) => a.toLowerCase() === who.toLowerCase())) ok.push(m);
    else log("market excluded: key is not its keeper", { market: m.key, keeper, signer: who });
  }
  if (ok.length === 0) throw new Error(`${who} is keeper on none of the markets`);
  return ok;
}
