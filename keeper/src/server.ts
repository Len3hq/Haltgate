import { createServer, type Server } from "node:http";
import { config } from "./config";
import { buildReport, formatReport } from "./report";
import type { Store } from "./store";
import type { State } from "./types";

// Read-only. Nothing here can change what the watcher does, so it is safe to
// leave public (Railway gives the service a URL) for an uptime monitor and for
// checking /report from anywhere.
//   GET /health   200 while the watcher AND keeper ticks are landing, 503 once
//                 either stops. Body carries warnings (low gas, last error).
//   GET /schedule  per testnet market: state + the next action's timeline.
//                  CORS-enabled, for the frontend's halt banner
//   GET /status   what every source reports, and each market's keeper state
//   GET /report   lead time per corporate action (?format=text for a table)
//   GET /events   recent raw events (?limit=N, default 100)

export function startServer(opts: {
  port: number;
  store: Store;
  getState: () => State;
  getKeeper: () => unknown;
  getKeeperHealth: () => { lastOkAt: number | null; lastError: string | null; gasLow: boolean; gasOkb: number | null } | null;
  getSchedule: () => unknown;
  pollIntervalMs: number;
  startedAt: number;
}): Server {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body, null, 2));
    };

    try {
      const now = Math.floor(Date.now() / 1000);
      const state = opts.getState();

      if (url.pathname === "/schedule") {
        res.setHeader("Access-Control-Allow-Origin", config.corsOrigin);
        if (req.method === "OPTIONS") {
          res.writeHead(204, { "Access-Control-Allow-Methods": "GET", "Access-Control-Max-Age": "86400" });
          return res.end();
        }
        res.setHeader("Cache-Control", "public, max-age=30");
        return json(200, { generatedAt: now, markets: opts.getSchedule() ?? [] });
      }
      if (url.pathname === "/health") {
        // Three missed intervals, plus room for one slow tick: a tick's own
        // RPC calls can take a minute or more (the first, on a cold RPC, did).
        const staleAfter = (3 * opts.pollIntervalMs) / 1000 + 120;
        // Grace period before the first tick lands.
        const watcherAge = now - (state.lastTickAt ?? opts.startedAt);
        const k = opts.getKeeperHealth();
        const keeperAge = k ? now - (k.lastOkAt ?? opts.startedAt) : null;
        const ok = watcherAge <= staleAfter && (keeperAge === null || keeperAge <= staleAfter);
        const warnings = [
          ...(k?.gasLow ? [`keeper gas low: ${k.gasOkb} OKB`] : []),
          ...(k?.lastError ? [`last keeper tick failed: ${k.lastError}`] : []),
        ];
        return json(ok ? 200 : 503, {
          ok,
          watcher: { lastTickAt: state.lastTickAt, ageSec: watcherAge },
          keeper: k ? { ...k, ageSec: keeperAge } : "off",
          warnings,
        });
      }
      if (url.pathname === "/status") return json(200, { watcher: state, keeper: opts.getKeeper() });
      if (url.pathname === "/report") {
        const rows = buildReport(await opts.store.readEvents());
        if (url.searchParams.get("format") === "text") {
          res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
          return res.end(formatReport(rows) + "\n");
        }
        return json(200, rows);
      }
      if (url.pathname === "/events") {
        const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 5000);
        return json(200, (await opts.store.readEvents()).slice(-limit));
      }
      json(404, { error: "not found", routes: ["/health", "/status", "/schedule", "/report", "/events"] });
    } catch (err) {
      json(500, { error: (err as Error).message });
    }
  });
  server.listen(opts.port);
  return server;
}
