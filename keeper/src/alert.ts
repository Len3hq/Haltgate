import { config } from "./config";
import type { WatchEvent } from "./types";

const iso = (ts: unknown) => (typeof ts === "number" ? new Date(ts * 1000).toISOString() : "?");
const hours = (sec: unknown) => (typeof sec === "number" ? `${(sec / 3600).toFixed(1)}h` : "?");

export function describe(e: WatchEvent): string {
  const who = `${e.ticker}${e.source ? ` (${e.source})` : ""}`;
  switch (e.type) {
    case "scheduled":
      return `📅 ${who}: ${e.reason ?? "corporate action"} scheduled, activates ${iso(e.activationTime)} (in ${hours(e.leadSec)}${e.seenOnStartup ? ", already pending at startup" : ""}). Multiplier ${e.currentMultiplier} → ${e.newMultiplier}`;
    case "rescheduled":
      return `🔁 ${who}: rescheduled from ${iso(e.previousActivationTime)} to ${iso(e.activationTime)}, multiplier → ${e.newMultiplier}`;
    case "cancelled":
      return `🚫 ${who}: action due ${iso(e.activationTime)} was cancelled before activating`;
    case "activated":
      return `✅ ${who}: activated at ${iso(e.activationTime)}, cleared ${e.clearedAfterSec}s later, multiplier applied: ${e.multiplierApplied}`;
    case "source-down":
      return `⚠️ ${who}: source failing: ${e.error}`;
    case "source-recovered":
      return `🟢 ${who}: source back after ${e.downForSec}s`;
    case "disagreement":
      return `❗ ${e.ticker}: sources disagree: ${e.detail}`;
    case "disagreement-resolved":
      return `🟢 ${e.ticker}: sources agree again`;
  }
}

export async function sendAlerts(events: WatchEvent[]) {
  await sendText(events.map(describe));
}

/// Best effort, to every configured channel. An alert failing must never stop
/// the watcher or the keeper.
export async function sendText(lines: string[]) {
  if (lines.length === 0) return;
  const text = lines.join("\n");
  const sends: Array<Promise<void>> = [];

  if (config.discordWebhookUrl) {
    sends.push(post("discord", config.discordWebhookUrl, { content: text.slice(0, 1900) })); // Discord caps at 2000
  }
  if (config.telegramBotToken && config.telegramChatId) {
    sends.push(
      post("telegram", `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
        chat_id: config.telegramChatId,
        text: text.slice(0, 4000), // Telegram caps at 4096
        disable_web_page_preview: true,
      }),
    );
  }
  await Promise.all(sends);
}

async function post(channel: string, url: string, body: unknown) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error(JSON.stringify({ level: "warn", msg: "alert failed", channel, error: (err as Error).message }));
  }
}

/// Dead-man's switch. A GET after each healthy tick; "/fail" appended when the
/// tick went wrong, which healthchecks.io treats as an immediate alert.
export async function pingHealthcheck(ok: boolean) {
  if (!config.healthcheckPingUrl) return;
  const url = ok ? config.healthcheckPingUrl : `${config.healthcheckPingUrl.replace(/\/$/, "")}/fail`;
  try {
    await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    // the pinged service alerts on silence anyway
  }
}
