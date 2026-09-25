// Everything tunable comes from the environment so the same code runs locally
// and on Railway. Nothing here is secret in Phase 0: the watcher only reads.

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number, got "${raw}"`);
  return n;
}

export const config = {
  mainnetRpcUrl: process.env.MAINNET_RPC_URL || "https://rpc.xlayer.tech",
  xstocksApiBase: process.env.XSTOCKS_API_BASE || "https://api.xstocks.fi/api/v2/public",
  /// The API returns the same schedule for every network (checked for NVDAx and
  /// MSFTx across XLayer, Ethereum and Solana), so XLayer is used throughout,
  /// including for MSFTx which has no X Layer mainnet token.
  xstocksNetwork: process.env.XSTOCKS_NETWORK || "XLayer",
  pollIntervalMs: num("POLL_INTERVAL_MS", 60_000),
  dataDir: process.env.DATA_DIR || "./data",
  port: num("PORT", 8080),
  /// Optional. Posts every schedule change here, so a new corporate action is
  /// noticed the moment it appears rather than whenever someone checks /report.
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  /// Optional, alongside or instead of Discord. Create a bot with @BotFather,
  /// message it once, then read your chat id from getUpdates.
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  /// Optional dead-man's switch (e.g. healthchecks.io). Pinged after every
  /// healthy tick; the service there alerts you when the pings stop, which is
  /// the one failure the keeper can't report itself: being dead.
  healthcheckPingUrl: process.env.HEALTHCHECK_PING_URL || "",
  /// Origin allowed to read /schedule from a browser (the frontend on Vercel).
  corsOrigin: process.env.CORS_ORIGIN || "*",
  /// Both sources pending with activation times further apart than this is
  /// reported as a disagreement. The contract stores exact seconds, the API an
  /// ISO string, so a small tolerance absorbs rounding only.
  activationToleranceSec: num("ACTIVATION_TOLERANCE_SEC", 60),
  /// One source pending and the other not is normal days out (that difference
  /// IS the lead time being measured), but alarming this close to activation.
  soloPendingAlarmSec: num("SOLO_PENDING_ALARM_SEC", 3600),

  // --- Keeper: acting on testnet ---------------------------------------------

  /// off      watch only, send nothing (the default, and Phase 0's behaviour)
  /// dry-run  decide every step and log it, send nothing
  /// live     send transactions. Needs KEEPER_PRIVATE_KEY
  keeperMode: mode(process.env.KEEPER_MODE),
  keeperPrivateKey: (process.env.KEEPER_PRIVATE_KEY || "").trim(),
  testnetRpcUrl: process.env.TESTNET_RPC_URL || "https://testrpc.xlayer.tech/terigon",
  finnhubApiKey: (process.env.FINNHUB_API_KEY || "").trim(),
  /// Comma-separated market keys the keeper may act on (nvda,tsla,aapl,msft,spy).
  /// Empty means all. Start with one while gaining confidence.
  keeperMarkets: (process.env.KEEPER_MARKETS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  /// The halt timeline around an activation time T.
  haltingLeadSec: num("HALTING_LEAD_SEC", 2 * 3600), // T - 2h   -> HALTING
  haltBufferSec: num("HALT_BUFFER_SEC", 15 * 60), //   T - 15m  -> HALTED, T + 15m -> resume allowed
  resumeCooldownSec: num("RESUME_COOLDOWN_SEC", 30 * 60), // time in RESUMING before OPEN
  stuckAfterSec: num("STUCK_AFTER_SEC", 6 * 3600), // still not settled this long after T -> alert
  /// Rebuilding a lost record from chain: a halt that started within this much
  /// of T - HALTING_LEAD (or later, up to T) is taken to be the keeper's own.
  adoptSlackSec: num("ADOPT_SLACK_SEC", 30 * 60),

  /// Price push (the port of script/keeper/push_prices.py). Off by default so
  /// the keeper never races the GitHub Actions push on the same key: turn this
  /// on and that workflow's schedule off together.
  pricePush: (process.env.PRICE_PUSH || "off").toLowerCase() === "on",
  priceIntervalMs: num("PRICE_INTERVAL_MS", 15 * 60_000),
  /// Market rejects a price older than 24h. Re-publish an unchanged price
  /// after this long so the feed never ages out over a weekend.
  priceRefreshAfterSec: num("PRICE_REFRESH_AFTER_SEC", 6 * 3600),

  /// Warn when the keeper's OKB drops below this. A full halt cycle costs
  /// ~0.00003 OKB at testnet gas prices and the price push ~0.002 OKB/day, so
  /// the default leaves days of warning.
  minGasBalanceOkb: num("MIN_GAS_BALANCE_OKB", 0.01),
};

function mode(raw: string | undefined): "off" | "dry-run" | "live" {
  if (process.argv.includes("--dry-run")) return "dry-run";
  const m = (raw || "off").toLowerCase();
  if (m === "off" || m === "dry-run" || m === "live") return m;
  throw new Error(`KEEPER_MODE must be off, dry-run or live, got "${raw}"`);
}
