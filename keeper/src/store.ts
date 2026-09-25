import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { State, WatchEvent } from "./types";

// Two files under DATA_DIR. On Railway that directory must be a mounted
// volume, or every redeploy wipes the measurements Phase 0 exists to collect.
//   state.json    what each source currently reports, so a restart resumes
//                 without re-announcing everything as newly "scheduled"
//   events.jsonl  append-only history; the report is computed from it

export class Store {
  constructor(private dir: string) {}

  private get statePath() {
    return join(this.dir, "state.json");
  }
  get eventsPath() {
    return join(this.dir, "events.jsonl");
  }

  async init() {
    await mkdir(this.dir, { recursive: true });
  }

  async loadState(now: number): Promise<State> {
    try {
      const s = JSON.parse(await readFile(this.statePath, "utf8")) as State;
      if (s.version === 1) return s;
    } catch {
      // first run, or unreadable: start fresh
    }
    return { version: 1, startedAt: now, lastTickAt: null, tickers: {} };
  }

  /// Write-then-rename so a crash mid-write cannot leave a truncated file.
  async saveState(state: State) {
    const tmp = `${this.statePath}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2));
    await rename(tmp, this.statePath);
  }

  /// Watcher events and keeper steps share one log, in order.
  async appendEvents(events: Array<WatchEvent | { at: number; type: string; [k: string]: unknown }>) {
    if (events.length === 0) return;
    await appendFile(this.eventsPath, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  }

  async readEvents(): Promise<WatchEvent[]> {
    let text: string;
    try {
      text = await readFile(this.eventsPath, "utf8");
    } catch {
      return [];
    }
    return text
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as WatchEvent];
        } catch {
          return []; // a torn last line after a crash
        }
      });
  }
}
