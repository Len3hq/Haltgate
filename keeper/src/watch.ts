import { pingHealthcheck, sendAlerts } from "./alert";
import { config } from "./config";
import { Keeper } from "./keeper/keeper";
import { stepTicker } from "./observe";
import { startServer } from "./server";
import { readApi } from "./sources/api";
import { readOnchain } from "./sources/onchain";
import { Store } from "./store";
import type { Reading, SourceName, State } from "./types";
import { buildWatchlist } from "./watchlist";

// Entry point. Every tick: read both corporate-action sources (the watcher),
// then, unless KEEPER_MODE=off, let the keeper move each testnet market toward
// where the schedule says it should be.
//
//   npm start                       watch (+ keeper per KEEPER_MODE), serve HTTP
//   npm run once                    one tick, print a summary, exit
//   npm run plan                    one tick in dry-run: what WOULD the keeper send?
//   ... --simulate nvda:20m         pretend NVDA has an action activating in 20 min

const nowSec = () => Math.floor(Date.now() / 1000);
const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));

const HEARTBEAT_EVERY_SEC = 3600;

/// "--simulate nvda:20m" (repeatable). Units s, m or h.
function parseSimulations(argv: string[]): Array<{ market: string; inSec: number }> {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--simulate") continue;
    const m = /^([a-z]+):(\d+)([smh])$/i.exec(argv[i + 1] ?? "");
    if (!m) throw new Error(`--simulate expects market:duration, e.g. nvda:20m, got "${argv[i + 1]}"`);
    out.push({ market: m[1].toLowerCase(), inSec: Number(m[2]) * { s: 1, m: 60, h: 3600 }[m[3].toLowerCase() as "s"] });
  }
  return out;
}

async function main() {
  const once = process.argv.includes("--once");
  const simulate = parseSimulations(process.argv);
  const watchlist = buildWatchlist();
  const store = new Store(config.dataDir);
  await store.init();
  let state: State = await store.loadState(nowSec());

  log("watcher starting", {
    tickers: watchlist.map((w) => `${w.ticker}${w.raw ? "" : " (api only)"}`),
    pollIntervalMs: config.pollIntervalMs,
    dataDir: config.dataDir,
    alerts: [
      config.discordWebhookUrl && "discord",
      config.telegramBotToken && config.telegramChatId && "telegram",
      config.healthcheckPingUrl && "healthcheck-ping",
    ].filter(Boolean),
    keeperMode: config.keeperMode,
  });

  if (simulate.length > 0 && config.keeperMode === "off") {
    throw new Error("--simulate needs the keeper: pass --dry-run or set KEEPER_MODE");
  }
  const keeper =
    config.keeperMode === "off"
      ? null
      : await Keeper.create({ mode: config.keeperMode, simulate, appendEvents: (e) => store.appendEvents(e) });

  async function watchTick(now: number) {
    const [onchain, api] = await Promise.all([readOnchain(watchlist), readApi(watchlist, now)]);

    const tickers = { ...state.tickers };
    const events = [];
    for (const w of watchlist) {
      const readings: Partial<Record<SourceName, Reading>> = { api: api.get(w.ticker) };
      if (w.raw) readings.onchain = onchain.get(w.ticker);
      const r = stepTicker(tickers[w.ticker], readings, now, w.ticker, config);
      tickers[w.ticker] = r.next;
      events.push(...r.events);
    }

    state = { ...state, tickers, lastTickAt: now };
    await store.appendEvents(events);
    await store.saveState(state);
    for (const e of events) log("event", e);
    await sendAlerts(events);
    return events.length;
  }

  async function tick() {
    const now = nowSec();
    const n = await watchTick(now);
    // The keeper runs on the readings just taken. If it throws, the watcher's
    // data is already saved; the next tick simply tries again.
    if (keeper) await keeper.tick(state, now);
    return n;
  }

  const pendingTickers = () =>
    Object.entries(state.tickers)
      .filter(([, t]) => t.onchain?.pending || t.api?.pending)
      .map(([ticker]) => ticker);

  if (once) {
    const n = await tick();
    const down = Object.entries(state.tickers).flatMap(([ticker, t]) =>
      (["onchain", "api"] as const).filter((s) => t[s]?.down).map((s) => `${ticker}/${s}`),
    );
    log("tick done", { events: n, pending: pendingTickers(), down });
    if (keeper) {
      const snap = keeper.snapshot();
      for (const [key, m] of Object.entries(snap.markets)) {
        const chain = m.chain && "state" in m.chain ? `${m.chain.state} @ $${m.chain.price}` : m.chain;
        log("market", { market: key, chain, pending: m.signal?.pending ?? null, record: m.record, lastSteps: m.lastSteps });
      }
    }
    return;
  }

  const server = startServer({
    port: config.port,
    store,
    getState: () => state,
    getKeeper: () => keeper?.snapshot() ?? null,
    getKeeperHealth: () => keeper?.health() ?? null,
    getSchedule: () => keeper?.schedule() ?? null,
    pollIntervalMs: config.pollIntervalMs,
    startedAt: nowSec(),
  });
  log("http listening", { port: config.port });

  let stopping = false;
  let timer: NodeJS.Timeout | undefined;
  let lastHeartbeat = 0;

  // setTimeout after each tick finishes, never setInterval: a slow RPC must
  // delay the next tick, not stack a second one on top of it.
  const loop = async () => {
    let ok = true;
    try {
      await tick();
    } catch (err) {
      ok = false;
      log("tick failed", { error: (err as Error).message });
    }
    await pingHealthcheck(ok);
    const now = nowSec();
    if (now - lastHeartbeat >= HEARTBEAT_EVERY_SEC) {
      lastHeartbeat = now;
      log("heartbeat", { pending: pendingTickers() });
    }
    if (!stopping) timer = setTimeout(loop, config.pollIntervalMs);
  };
  void loop();

  const shutdown = (signal: string) => {
    stopping = true;
    clearTimeout(timer);
    log("shutting down", { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  log("fatal", { error: (err as Error).stack ?? String(err) });
  process.exit(1);
});
