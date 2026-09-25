# HaltGate keeper

A standalone service, deployed separately from the frontend (Railway, not Vercel). It watches the real xStocks for scheduled corporate actions and halts the matching HaltGate testnet market around each one, then reopens it, with nobody running `halt.sh`.

It uses the contracts already deployed. No contract changes are needed: it calls the same functions `script/demo/halt.sh` calls by hand.

## How a halt happens

Take a real NVIDIA dividend that activates at T:

| When | Keeper does (NVIDIA market only) | Market |
|---|---|---|
| T − 2h | `beginHalting()` | HALTING: no new supply, borrow or liquidation |
| T − 15m | multisig `pauseOracle()`, then `sync()` | HALTED: repay only, interest frozen |
| T | nothing; the xStock's multiplier switches by itself | |
| T + 15m, once the new multiplier is in place | fresh Finnhub quote → multisig `resumeOracle(price)`, then `sync()` | RESUMING: liquidations still off |
| + 30 min, if the price is fresh **and `isSystemSolvent()`** | `completeResume()` | OPEN |

All windows are configurable. The other four markets are untouched: each is an isolated stack, and the keeper maps each stock to exactly one market.

Safety rules the keeper follows:

- **It only lifts halts it started.** A halt from `halt.sh`, or anything it can't match to a scheduled action, is left alone and reported. It remembers its own halts in `keeper.json`. If that file is lost, it can still recognise its halt from the on-chain `haltStartedAt`, but only while the action is still upcoming.
- **It never reopens without the new multiplier in place, a fresh post-action price, the cooldown, and solvency.** If solvency fails it holds in RESUMING and alerts you.
- **It halts immediately when an action is first seen late.** This really happens: SPY's 2026-06-18 dividend was scheduled on-chain only 9 minutes before activation, so the keeper goes straight to HALTED.
- **If the sources disagree, it acts on the earlier time.** A false halt is cheap; a missed one isn't.
- **A source going down is never read as "cancelled".** Only a withdrawal that both sources confirm reopens the market early.
- **It never touches SETTLING.**
- **Every multisig call is simulated first**, so a call that would revert never leaves a dangling proposal. The proposal's `txId` is read from its own receipt.

## Where the signal comes from

| Ticker | On-chain (X Layer mainnet raw token) | xStocks API | Testnet market |
|---|---|---|---|
| NVDA, TSLA, AAPL, SPY | ✓ | ✓ | ✓ |
| MSFT | — (no X Layer token) | ✓ | ✓ |
| GOOGL, MSTR, COIN, QQQ | ✓ | ✓ | — (watched for data) |

The list is built from [frontend/lib/mainnet.ts](../frontend/lib/mainnet.ts) and [frontend/lib/contracts.ts](../frontend/lib/contracts.ts), so a redeploy that updates those is picked up automatically.

- **On-chain.** From Backed's token source ([backed-fi/backed-token-contract](https://github.com/backed-fi/backed-token-contract)): an action is pending exactly when `newMultiplierActivationTime() > block.timestamp`. At that second `multiplier()` switches to `newMultiplier()` with no transaction. The contract also won't accept a schedule more than 7 days ahead.
- **API.** `GET https://api.xstocks.fi/api/v2/public/assets/{SYMBOL}x/multiplier?network=XLayer`: public and free. It also gives the reason (Dividend, Split).

**Measured warning time** (`npm run backfill`, every action since the tokens gained scheduling):

| Ticker | Activation (UTC) | On-chain warning |
|---|---|---|
| QQQ | 2026-09-19 23:00 | 5.5h |
| NVDA | 2026-09-10 00:30 | 4.0h |
| GOOGL | 2026-09-04 00:30 | 3.9h |
| AAPL | 2026-08-08 00:30 | 4.1h |
| QQQ | 2026-06-21 23:55 | 5.4h |
| GOOGL | 2026-06-07 23:55 | 9.1h |
| SPY | 2026-06-18 04:00 | **9 min** |

The API's own warning time can only be measured live. `/report` shows it once the service has seen a few actions.

## Modes

| `KEEPER_MODE` | What it does |
|---|---|
| `off` (default) | Watch only. Records every schedule change, sends nothing |
| `dry-run` | Decides every step and logs it (including the resume price it would use), sends nothing |
| `live` | Sends transactions. Needs `KEEPER_PRIVATE_KEY` and `FINNHUB_API_KEY` |

On startup, live mode checks that the key is a multisig signer, that the threshold is 1, and that the key is keeper or owner of each market's `HaltController`. Markets it can't drive are skipped, with a log line saying why.

## Run it locally

```bash
cd keeper
npm install
npm test                                  # policy, parsing and price tests
npm run once                              # one poll, summary, exit
npm run plan                              # one poll in dry-run: what would it send right now?
npm run plan -- --simulate nvda:20m       # ...if NVDA had an action in 20 minutes?
npm start                                 # run forever, http://localhost:8080
npm run report                            # warning-time table from ./data
npm run backfill                          # warning times for past actions
```

### Rehearsing a full cycle safely

`--simulate <market>:<duration>` injects a fake action for one market and drives it through the whole cycle. Shorten the windows so it takes minutes instead of hours.

To try it without touching the public testnet, run it against a local fork. The fork impersonates the multisig and timelock so a throwaway key can act. This is how the keeper was tested:

```bash
anvil --fork-url https://testrpc.xlayer.tech/terigon --port 8546 --auto-impersonate &
F=http://127.0.0.1:8546
MS=0x46Af2FD4bF206321Bcd24A58F4497B2681C7716F   # multisig
TL=0x6e4591c9A44C28f29F570B19ab82781BA136305F   # timelock (owns the HaltControllers)
HC=0x4C4AC6fd104Eb8CE9887a0e7Da757f86d08EE807   # NVIDIA HaltController
K=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266    # anvil's first dev account
cast rpc anvil_setBalance $MS 0x56BC75E2D63100000 -r $F
cast rpc anvil_setBalance $TL 0x56BC75E2D63100000 -r $F
cast send $MS "addSigner(address)" $K --from $MS --unlocked -r $F
cast send $HC "setKeeper(address)" $K --from $TL --unlocked -r $F

KEEPER_MODE=live TESTNET_RPC_URL=$F KEEPER_MARKETS=nvda \
KEEPER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
FINNHUB_API_KEY=... POLL_INTERVAL_MS=10000 \
HALTING_LEAD_SEC=120 HALT_BUFFER_SEC=30 RESUME_COOLDOWN_SEC=30 DATA_DIR=./data-fork \
npm start -- --simulate nvda:3m
```

The market goes OPEN → HALTING → HALTED → RESUMING → OPEN in about five minutes.

## Configuration

| Variable | Default | |
|---|---|---|
| `KEEPER_MODE` | `off` | `off`, `dry-run` or `live` |
| `KEEPER_PRIVATE_KEY` | — | Live only. Must be a multisig signer and each market's keeper. Use a dedicated key, set up with `npm run authorize-keeper` (below), never the deployer key |
| `FINNHUB_API_KEY` | — | Live only: the resume price (and the price push, if enabled) |
| `KEEPER_MARKETS` | all | e.g. `nvda` to start with one market |
| `HALTING_LEAD_SEC` | `7200` | HALTING this long before T |
| `HALT_BUFFER_SEC` | `900` | HALTED from T − this; resume allowed from T + this |
| `RESUME_COOLDOWN_SEC` | `1800` | Minimum time in RESUMING |
| `STUCK_AFTER_SEC` | `21600` | Alert if the new multiplier isn't in place this long after T |
| `ADOPT_SLACK_SEC` | `1800` | Tolerance when recognising its own halt without a record |
| `PRICE_PUSH` | `off` | `on` runs the price push (port of `script/keeper/push_prices.py`) in this process. See below |
| `PRICE_INTERVAL_MS` | `900000` | How often the price push runs |
| `PRICE_REFRESH_AFTER_SEC` | `21600` | Re-publish an unchanged price after this long, so the 24h staleness limit is never hit |
| `TESTNET_RPC_URL` | `https://testrpc.xlayer.tech/terigon` | |
| `MAINNET_RPC_URL` | `https://rpc.xlayer.tech` | Where the on-chain signal is read |
| `POLL_INTERVAL_MS` | `60000` | |
| `DATA_DIR` | `./data` (image: `/data`) | `state.json`, `events.jsonl`, `keeper.json`. **Must be a volume on Railway** |
| `PORT` | `8080` | Railway sets this |
| `DISCORD_WEBHOOK_URL` | — | Alerts: every schedule change, keeper step, state change and warning |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | — | The same alerts to Telegram. Either channel, or both |
| `HEALTHCHECK_PING_URL` | — | Dead-man's switch, e.g. a healthchecks.io check URL. Pinged after every tick (`/fail` on a failed one) |
| `MIN_GAS_BALANCE_OKB` | `0.01` | Warn when the keeper key's balance drops below this |
| `CORS_ORIGIN` | `*` | Origin allowed to read `/schedule` from a browser. Set it to the frontend's, e.g. `https://haltgate.len3.xyz` |
| `ACTIVATION_TOLERANCE_SEC`, `SOLO_PENDING_ALARM_SEC` | `60`, `3600` | When the two sources count as disagreeing |

### The price push replaces the GitHub Actions workflow

`.github/workflows/keeper.yml` pushes prices hourly from the deployer key. Once the keeper is live, `PRICE_PUSH=on` does the same job here, from the keeper key, every 15 minutes. Then turn off the GitHub schedule so the two don't both push:

```bash
gh workflow disable "Oracle keeper"      # reversible: gh workflow enable "Oracle keeper"
```

## HTTP (read-only)

| Route | |
|---|---|
| `GET /health` | 200 while both the watcher and the keeper complete ticks, 503 after 3 missed intervals (+2 min grace for a slow tick). The body lists warnings (low gas, last tick error). Point an uptime monitor here |
| `GET /schedule` | Per testnet market: state, plus the tracked action and its timeline (halting, halted, resume and reopen times). CORS-enabled for the frontend |
| `GET /status` | Everything: watcher readings, plus per market the chain state, signal, the keeper's record and last steps |
| `GET /report` | Warning time per corporate action (`?format=text` for a table) |
| `GET /events?limit=N` | Watcher events and keeper steps, in order |

Nothing here can trigger an action.

## A dedicated keeper key

The service shouldn't hold the deployer key. `npm run authorize-keeper` gives a fresh key the two roles the keeper needs, using the deployer key once, from your machine:

1. **Multisig signer**, to pause and resume oracles. `addSigner` can only be called by the multisig itself, so it's proposed and executed through the multisig.
2. **`HaltController.keeper`** on all five markets. `setKeeper` is owned by the timelock: the multisig schedules one batch, and after the 10-minute delay anyone can execute it.

```bash
cast wallet new                                  # the keeper key; keep the private key for Railway only
cd keeper
ADMIN_PRIVATE_KEY=<deployer key> npm run authorize-keeper -- --keeper <new address> --fund 0.05 --wait
```

It's safe to rerun: each run checks what's already done and continues from there. Without `--wait` it stops after scheduling and tells you when to run it again. It finishes by printing each market's keeper. This was tested end to end against a fork of the live testnet.

**Be clear about what the key can still do.** The multisig is 1-of-1, so any signer can propose and execute alone. That makes the keeper key a full multisig signer: in principle it could also schedule timelock changes, with the 10-minute delay. On testnet that's acceptable. What this step does achieve is that the **deployer key never sits on a server**, and the keeper key can be revoked (multisig `removeSigner`, timelock `setKeeper`) without redeploying anything. Moving the halt rules on-chain, so the keeper needs no trust at all, is on the roadmap for the mainnet deployment: see `/docs/roadmap` in the app and `BUILD.md` §13.

## Alerts and monitoring

Four independent layers, so no single failure goes unnoticed:

| Layer | Catches | Set up |
|---|---|---|
| Alerts (Discord and/or Telegram) | New or changed corporate actions, every keeper step, **every state change on any market, whoever caused it**, failed transactions, stuck or unexplained halts, solvency holds, source disagreements, low gas | `DISCORD_WEBHOOK_URL`, or `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` |
| Dead-man's switch | The keeper process dying or hanging, which it can't report itself | Create a check on healthchecks.io (free), period 5 min, grace 5 min; set its URL as `HEALTHCHECK_PING_URL` |
| Uptime monitor | The service unreachable, or `/health` going 503 | UptimeRobot or Better Stack (free) on `<railway-url>/health` |
| Sync watchdog | A market left out of step with its oracle (e.g. the keeper died between pausing the oracle and syncing) | The `watchdog` Railway service, below |

### The sync watchdog

A second Railway service, `watchdog`, runs the same image with `KEEPER_ENTRY=src/tools/sync-watchdog.ts`. It runs in its own container with its own key, so it keeps working if the keeper crashes. Every 3 hours (`WATCHDOG_INTERVAL_MS`) it calls the permissionless `HaltController.sync()`, and only on markets that have drifted from their oracle.
- It **can't start or finish a halt**: that needs the keeper and the multisig.
- It **can't do harm**: `sync()` only ever makes the market match its oracle.
- If it had to fix something, it alerts through the same Discord/Telegram variables, because that means the keeper missed it.

Its only costs are one idle container and gas of about 0.000002 OKB per sync. Try it locally with `npm run sync-watchdog -- --dry-run`.

## "Next corporate action" in the app

`frontend/components/dashboard/CorporateActionNotice.tsx` adds one line under the halt banner on each market page, read from this service's `/schedule`:
- **before an action:** "Upcoming dividend, effective … New borrowing pauses from … and the market halts at …";
- **during a halt:** when it's expected to reopen.

To turn it on, set `NEXT_PUBLIC_KEEPER_URL=<railway-url>` in Vercel's environment variables and redeploy (the value is fixed at build time). Set `CORS_ORIGIN` here to the site's origin. While the variable is unset, or the keeper can't be reached, the line doesn't render. The banner's state always comes from the chain, not from the keeper.

## Deployment (Railway)

Railway project **`haltgate-keeper`**, with two services built from the same image:

| Service | Runs | Variables |
|---|---|---|
| `keeper` | `src/watch.ts`: the watcher, halts and price push. Volume at `/data`. Public URL for `/health`, `/schedule`, `/status`, `/report` | `KEEPER_MODE`, `KEEPER_PRIVATE_KEY`, `FINNHUB_API_KEY`, `CORS_ORIGIN`, `PRICE_PUSH`, plus optional alert variables |
| `watchdog` | `src/tools/sync-watchdog.ts` in loop mode | `KEEPER_ENTRY=src/tools/sync-watchdog.ts`, `WATCHDOG_INTERVAL_MS`, `WATCHDOG_PRIVATE_KEY`, plus optional alert variables |

Secrets exist only as Railway variables. They were piped in through stdin and never written to the repo or to disk. To see one, use the Railway dashboard (service → Variables).

**Deploying a change** from this machine:

```bash
keeper/scripts/railway-deploy.sh keeper
keeper/scripts/railway-deploy.sh watchdog
```

The script uploads only what the image needs (29 files): no `.env`, no `node_modules`, nothing else from the working tree. Alternatively, once `keeper/` is pushed, connect the services to GitHub for deploy-on-push (`railway service source connect --repo <owner/repo> --branch main --service keeper`) and set each service's config file to `keeper/railway.json`.

Keep exactly one replica of each. Two keepers would race each other.

**Cost:** two small always-on Node processes that mostly sleep, which should sit inside the Hobby plan's included $5 of usage. Gas is negligible: a full halt cycle costs about 0.00003 OKB, and the price push about 0.002 OKB/day.

### Going from dry-run to live

1. **Authorise the keeper key on-chain:** `ADMIN_PRIVATE_KEY=<deployer key> npm run authorize-keeper -- --keeper <keeper address> --fund 0.05 --wait` (see "A dedicated keeper key").
2. **Fund the watchdog key** with about 0.01 OKB.
3. On the `keeper` service: `KEEPER_MODE=live`, `PRICE_PUSH=on`. The `keeper ready` log line then shows the signer and the markets it's authorised for.
4. `gh workflow disable "Oracle keeper"`.
5. Optional: alert variables on both services, a healthchecks.io URL, an uptime monitor on `/health`, and `NEXT_PUBLIC_KEEPER_URL` on Vercel.

## Files

```
src/watch.ts              main loop: watcher tick, then keeper tick
src/observe.ts            pure: source readings -> schedule events
src/sources/onchain.ts    one Multicall3 read of every raw xStock
src/sources/api.ts        xStocks API, defensive parsing
src/keeper/policy.ts      pure: chain + signal + record -> steps (the halt timeline)
src/keeper/keeper.ts      runs the policy per market, executes, remembers its halts
src/keeper/signer.ts      one serial tx queue: local nonces, receipts, multisig propose+execute
src/keeper/prices.ts      Finnhub quotes, price-push stepping
src/testnet/markets.ts    market table + one multicall read of every market
src/testnet/abis.ts       minimal ABIs for the deployed contracts
src/tools/authorize-keeper.ts  moves the keeper role to a dedicated key (multisig + timelock)
src/tools/sync-watchdog.ts     the sync() backstop (its own Railway service)
scripts/railway-deploy.sh      stages the minimal upload and runs railway up
src/store.ts, report.ts, server.ts, alert.ts, backfill.ts
Dockerfile, railway.json  the image both services run; KEEPER_ENTRY picks the entry point
```
