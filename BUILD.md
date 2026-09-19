# HaltGate — Build Spec (v1.1, hackathon-scoped)

**Target:** OKX Dev Day 2026 · Track: **Tokenized Stocks & RWA on X Layer** · Application deadline Sept 15, 2026, 23:59 (confirmed, extended) · Build window Sept 17–25 (9 days) · Submission Sept 25 · Finale Oct 6, Singapore
**Status:** Reviewed by council 2026-09-14. Two full verification passes completed 2026-09-14/15 — every technical blocker is now resolved. See §3.
**Repo:** github.com/Len3hq/Haltgate

> ⚠️ **Deadline:** application closes tonight (Sept 15, 23:59). Submit regardless of remaining open items — free, non-binding.

---

## 0. Glossary

| Term | Meaning |
|---|---|
| **xStock** | A tokenized US stock/ETF (e.g. TSLAx, NVDAx, SPYx), issued by Backed and distributed by OKX on X Layer. Exists in two forms — see below. |
| **Raw xStock** | The native form. On EVM chains, its `balanceOf()` rebases on-chain when a corporate action occurs. |
| **Wrapped xStock (e.g. wNVDAx)** | A non-rebasing wrapper around a raw xStock — balance stays fixed, value accrues via an increasing exchange rate instead (wstETH-style). Confirmed liquid on X Layer; raw forms are not. |
| **Multiplier** | The on-chain scaling factor xStocks/Backed uses to reflect dividends/splits for raw xStocks. |
| **Corporate action (CA)** | A dividend, split, or other event that changes a multiplier / triggers an oracle pause. |
| **`pauseOracle()`** | Backed's own confirmed mechanism: the xStocks price oracle freezes at its last known value during a corporate action, resuming once the multiplier/price is settled. This is the actual trigger HaltGate keys off. |
| **USDG** | Paxos's Global Dollar stablecoin — the debt/lending denomination. Real testnet USDG is confirmed available on X Layer via faucet.paxos.com. |
| **HaltController** | This build's core differentiator: tracks whether a market is safe to operate on, gated by oracle/CA state. |
| **Corporate Action Guard** | A real, third-party, unaudited project live on X Layer testnet doing an adjacent gating primitive — see §2. |

---

## 1. The problem (verified 2026-09-14/15)

X Layer has real xStocks activity and no on-chain financing for it:
- Aave on X Layer lists USDT0/USDG/GHO/xBTC/xETH/xSOL/xBETH/xOKSOL — **confirmed via six independent outlets** — no tokenized equity of any kind, raw or wrapped.
- Kamino, Jupiter Lend, and Morpho all do xStock-collateral lending elsewhere (Solana, Ethereum) — confirmed, not on X Layer.
- A real USDG/wNVDAx pool exists on X Layer's Uniswap with confirmed liquidity (~$588K TVL, verified directly) — so the demand and the tradeable asset are both real; only the lending layer is missing.
- **xStocks market-cap claim ($91.5M / 836 assets) is single-sourced to one uncited Crypto Briefing article — treat as plausible, not confirmed. Do not cite as a hard number in the pitch without independently pulling it from a primary dashboard first.**

This is an X Layer-specific gap: the asset exists here, the trading venue exists here, the lending venue does not.

---

## 2. Prior art (verified 2026-09-14)

**Corporate Action Guard** (github.com/gnanam1990/corporate-action-guard) — real, live, adjacent:
- Live on X Layer testnet (chain 1952): Adapter `0x5419941472c4a42FF0D68694c2A88F1b4716C337`, Vault `0x2Dcb9Fb8044069B4A0eECf3CEaB7db9792Cf1f02`, Asset (explicitly a labelled `TESTNET FIXTURE`, not a real xStock) `0x16626cD009e3917C90Aa7c3d3c30A67aF7B508E1`.
- 8/8 adversarial test scenarios pass (replay, mutated recipient/amount, expiry, scheduled CA, guard window, unauthorized signer, intentional-bypass transfer) — [PR #9](https://github.com/gnanam1990/corporate-action-guard/pull/9).
- Scope: fail-closed preflight/receipt checking only — no borrowing, leverage, liquidation, or vault logic. A gating primitive to reference, not a lending competitor.
- Not production-ready or audited; single builder; own verdict CONDITIONAL, not proven.

**Design decision:** follow Corporate Action Guard's gating *pattern* rather than rebuild from scratch — but note its gate is keyed to a receipt/schedule model, not the oracle-pause mechanism HaltGate now uses (§3). Treat it as a reference implementation of the general "fail closed during CA" idea, not a drop-in dependency.

---

## 3. Verified technical facts — every blocker resolved

### 3.1 The core mechanism (confirmed, primary sources)

- **Raw xStocks rebase `balanceOf()` on EVM chains** (X Layer included); on Solana the balance stays constant and the multiplier is display-layer only — confirmed from xStocks' own developer docs.
- **Backed Finance (xStocks' issuer) runs its own oracle pause during corporate actions** — `pauseOracle()` freezes the price feed at its last known good value while a CA is processed, then resumes once the multiplier is settled. **This is confirmed as Backed's own documented behavior, not inferred from an adjacent product.**
- **Chainlink is xStocks' official oracle infrastructure** — confirmed via both xStocks' and Chainlink's own announcements, including "xStocks Data Streams" with real-time corporate-action verification.
- **A real third-party corporate-actions feed exists**: CF Benchmarks publishes an "xStocks Corporate Action Feed" with a documented methodology — a genuine upgrade path beyond a manually-toggled schedule, not just a hoped-for possibility.

**What this means for the build:** the halt mechanism is not just valid for raw, rebasing xStocks — it's validated at the oracle layer, which means it applies equally to **wrapped, non-rebasing xStocks like wNVDAx**. A stock split still cuts the per-share price whether or not the token's own balance changes; Backed's own oracle freezes during that window regardless of which form of the token is priced off it. **This resolves the wrapped-asset concern raised during pre-build verification — wNVDAx is a valid, liquid, thesis-consistent collateral asset.**

### 3.2 Collateral asset: wNVDAx (confirmed)

- Real USDG/wNVDAx liquidity confirmed directly on X Layer's Uniswap (~$588K TVL).
- Wrapped xStocks (the `w` prefix — WNVDAX, WCOINX, etc.) are confirmed non-rebasing by design, "to allow them to be used within DeFi applications" — balance fixed, value carried in an accruing exchange rate (wstETH-style).
- **This liquidity is on X Layer mainnet.** No wNVDAx (or any xStock, raw or wrapped) is confirmed to exist on X Layer testnet — same conclusion as for raw assets, see §3.3.

### 3.3 Testnet reality (confirmed)

- X Layer testnet is real: chain ID **1952** (current — 195 is deprecated, 196 is mainnet, confirmed via chainid.network/ChainList).
- **Real testnet USDG is available for X Layer — confirmed directly via faucet.paxos.com.** No mock-USDG fallback needed.
- **No real xStocks contract (raw or wrapped) is confirmed to exist on X Layer testnet.** Corporate Action Guard's own testnet asset is an explicit `TESTNET FIXTURE`, not a real token — this was independently verified, correcting an earlier inaccurate AI-search-summary claim.
- USDG's real, verified **mainnet** contract address on X Layer: `0x4ae46a509f6b1d9056937ba4500cb143933d2dc8` — [Paxos usdg-contract repo](https://github.com/paxosglobal/usdg-contract).

### 3.4 Oracle availability and pause detection — RESOLVED 2026-09-18

This was the long-standing open item ("is a live Chainlink feed queryable on X Layer?"). Answered, and the answer changes two design assumptions.

**Real price data for NVDA does exist on X Layer — mainnet only.** OKX adopted Chainlink on X Layer mainnet in June 2026, with coverage explicitly including 24/5 equities streams for TSLA, NVDA and AAPL. Nothing equivalent exists on testnet, which is why the mock oracle stays for this build.

**But it's Data Streams, not Data Feeds — a different integration shape, not an address swap.** Data Feeds are push-based: a contract sits on-chain holding a current price you read with `latestRoundData()`. Data Streams are **pull-based**: reports are signed off-chain and the *consumer* submits one with their transaction, verified on-chain against a verifier contract. There is no contract holding a readable current price.

That breaks an assumption in the current design. `Market._requireFreshPrice()` reads a price mid-transaction inside `borrow()` and `liquidate()`; under Data Streams there is nothing to read, so every price-dependent action would need a signed report passed in by the caller. The halt state machine, gating, settlement and leverage stack are all unaffected — this is purely the ingestion layer, but it is real engineering, not configuration.

**No feed exposes a pause flag.** Chainlink's own tokenized-equity integrator docs are explicit: consumers detect a corporate-action pause via **staleness**, not a boolean — *"Integrators should read `updatedAt` and implement staleness bounds appropriate to their use case."* The pause state lives in the issuer's oracle registry, off-chain. The behaviour itself is confirmed — *"Paused mode (`paused == true`): The feed stops publishing new prices and holds the last known good value"* — it simply isn't queryable from a contract.

So `IPausableOracle.isPaused()` is a mock convenience, not a real interface. The production-correct detection path is the staleness check `Market._requireFreshPrice()` **already implements** against `maxOracleStaleness`.

**The complication that needs solving before mainnet:** these feeds also stop updating during ordinary market closure — *"these feeds do not have heartbeats during off-hours"* (weekends, holidays, overnight). Staleness alone therefore cannot distinguish "corporate action in progress" from "it is Saturday," and a naive staleness-triggered halt would halt the market every weekend. Distinguishing them requires either the CF Benchmarks corporate-action feed (§3.1) or a market-hours calendar. That promotes the CF Benchmarks integration from a roadmap nicety to the actual missing piece of a mainnet halt trigger.

Sources: [Chainlink tokenized-equity feed docs](https://docs.chain.link/data-feeds/tokenized-equity-feeds), [OKX × Chainlink Data Streams on X Layer](https://web3.okx.com/learn/xlayer-chainlink-data-streams).

---

## 4. v1 scope — the hackathon-buildable slice

**In scope for v1:**

1. **Halt-gating primitive** — tracks OPEN / HALTING / HALTED / RESUMING for one market, triggered by oracle-pause state (§3.1), not balance-rebase detection. Live Chainlink feed if reachable (§3.4); otherwise a mock oracle replicating the same `pauseOracle()` pattern against the real, confirmed CA timing schedule.
2. **Single-market borrow/repay** — deposit collateral, borrow USDG, repay. No leverage, no LP collateral, no basket lines.
3. **Collateral asset: wNVDAx** (§3.2) — named and locked in, not a placeholder.
4. **Corporate-action schedule**: real known timing (00:30 UTC day-after-Ex-Date) drives the halt window regardless of whether a live oracle feed is reachable — this was always the fallback design and remains valid.

**Testnet-vs-mainnet demo decision — explicit, not yet made:**
- **Testnet (default/safer):** since no wNVDAx exists on testnet, deploy a mock wNVDAx-equivalent (non-rebasing, exchange-rate-accruing, matching confirmed wrapped-token semantics) paired with real testnet USDG. Zero real-fund risk.
- **Mainnet stretch (more credible to judges, real risk):** use the actual confirmed wNVDAx/USDG pool and real USDG, in small amounts, for a live "this is really happening onchain" demo. Only pursue this once the testnet version works end-to-end, and only with amounts the team is fully comfortable losing during a public demo.

**Explicitly out of scope for v1:**
- Multiply / leveraged loops.
- LP-token-as-collateral.
- Basket credit lines across multiple tickers.
- RiskModule tiering by asset class (one fixed LTV/liquidation threshold is enough for the demo).
- AgentAdapter / OKX AI policy wrapper.
- CF Benchmarks feed integration (§3.1) — name it in the pitch as a real, confirmed upgrade path; don't spend build time wiring it unless everything else is done early.
- Everything in the original brief's full architecture beyond what's listed above — roadmap, not build.

---

## 5. Halt state machine and allow-list

```
OPEN → HALTING → HALTED → RESUMING → OPEN
```

| State | Allowed | Not allowed |
|---|---|---|
| OPEN | Everything | — |
| HALTING | Repay, delever | New supply, new borrow |
| HALTED | Repay only | Supply, borrow, liquidation, admin force-resume via multisig+reason-hash as escape hatch |
| RESUMING | System checks total collateral value vs. debt before returning to OPEN | Liquidations wait until fully OPEN — expected to be dangerous immediately after resume; surface this in the UI |

**Trigger (updated):** oracle-pause state (`pauseOracle()`-equivalent, live or mocked per §3.4) is the primary signal. The known CA activation timing (00:30 UTC day after Ex-Date, confirmed real) sets the expected window either way, with an admin-configurable pre/post buffer (e.g. 30–120 min).

---

## 6. Edge cases

| # | Edge case | Required handling |
|---|---|---|
| 1 | No real xStocks (raw or wrapped) exist on X Layer testnet | Mock wNVDAx-equivalent token, non-rebasing/exchange-rate-accruing, paired with real testnet USDG. State this plainly in the pitch. |
| 2 | No live price feed reachable on X Layer testnet | Resolved (§3.4): real NVDA data exists on X Layer *mainnet* only, and as pull-based Data Streams rather than a readable feed. Mock oracle keyed to the same real CA timing stays for this build — a substitution of data source, not a design compromise. |
| 2b | A mainnet halt trigger can't tell a corporate action from a weekend | Staleness detection alone is ambiguous — feeds have no off-hours heartbeat (§3.4). Needs the CF Benchmarks CA feed or a market-hours calendar before any mainnet halt trigger is trustworthy. Out of scope for this build; named explicitly rather than glossed. |
| 3 | Corporate Action Guard's gate model doesn't match HaltGate's oracle-pause trigger | Reference its pattern, don't force a direct dependency — its receipt/schedule model and HaltGate's oracle-state model solve the same class of problem differently. |
| 4 | Liquidation math untestable against a real CA event in a 9-day window | Use the CA-timing toggle to simulate a halt/resume cycle for the demo; don't claim mainnet-readiness is proven. |
| 5 | Interest accrual during halt | Freeze the interest index during HALTED — disclose this rather than silently accruing. |
| 6 | Admin/multisig force-resume misuse | Accept explicitly for hackathon scope; document via a named timelock, not an unbounded owner key. |
| 7 | Wrong collateral address wired in | Immutable per-market whitelist set at deploy. |
| 8 | Mock asset/oracle diverges from real xStocks/Chainlink semantics in an undiscovered way | Flag in the pitch that mainnet deployment requires re-verifying every assumption in §3 against the real contracts before real funds are at risk. |
| 9 | Team pursues the mainnet stretch demo (§4) and a real CA event or oracle hiccup occurs live | Have a manual pause/kill-switch path ready before attempting a mainnet demo — do not rely solely on automated triggers for a live public demo with real funds. |

---

## 7. Open risks / unverified dependencies

- ~~**Live Chainlink feed reachability for wNVDAx on X Layer**~~ — **resolved 2026-09-18, see §3.4.** Real NVDA data exists on X Layer *mainnet* via Chainlink Data Streams; nothing on testnet, so the mock stays. Two consequences replace this risk: Data Streams is pull-based (price ingestion must be rebuilt, not repointed), and no feed exposes a pause flag (detection is staleness-based, which can't tell a corporate action from a weekend without a CA feed or market-hours calendar).
- **Backed's documented `pauseOracle()` behaviour** (§3.1) — the single load-bearing fact of the whole thesis. Chainlink's own tokenized-equity docs independently corroborate the pause behaviour, but re-check the primary source before presenting: if this is overstated, the premise weakens.
- **xStocks $91.5M/836-asset market-cap figure** — single-sourced, don't cite as confirmed in the pitch without independently pulling it from a primary dashboard.
- **OKX Dev Day's specific judging rubric** (Innovation/Market Value/Completion weighting, AI auto-scoring, Demo Video bonus) — **not stated on the official event page**, which instead says "final... judging criteria will be shared with selected teams." Build toward "a working, onchain-verifiable product," which the page does explicitly say is the bar, rather than optimizing for an unconfirmed scoring mechanic.
- **OKX Dev Day RWA track's specific claimed partner list** (Paxos, Morningstar, Centrifuge) — still not independently confirmed; doesn't block the build.
- **Corporate Action Guard's willingness to be integrated with** — untested; bounded risk since the fallback is following its pattern independently, not a hard runtime dependency.

---

## 8. Build plan

**Before Sept 17 (tonight/tomorrow):**
- Submit the Dev Day application tonight if not already done — deadline is 23:59 today.
- Check whether a live Chainlink price feed for wNVDAx is reachable on X Layer (§3.4) — 15 minutes, determines whether the halt trigger reads a real feed or a mock one.
- Decide testnet-only vs. mainnet-stretch demo path (§4) as a team — don't leave this undecided into Day 1.

**Day 1, hard gate, end of day:**
- Confirm the halt-gating contract compiles and deploys against the mock (or real, if pursuing mainnet) wNVDAx-equivalent and its oracle.
- If it fails: reduce scope to the halt state machine alone as a standalone Skills Arena submission.

**By Day 3:** single-market borrow/repay working end-to-end on testnet, correctly gated by oracle-pause state.

**Days 4–9:** demo polish (CA-timing walkthrough showing OPEN→HALTED→RESUMING blocking risky actions), mainnet stretch attempt if Day 3 lands early and the team is comfortable with it, pitch narrative naming Multiply/LP/RiskModule/AgentAdapter/CF Benchmarks integration as confirmed-real roadmap, not built features.

---

## 9. Success criteria for submission

- A real X Layer deployment (testnet minimum, mainnet if pursued) showing: deposit collateral → borrow USDG → halt triggers correctly around a CA window → all risk-opening actions revert during HALTED → repay succeeds during HALTED → resume restores normal operation.
- A pitch that states plainly and accurately: the oracle-pause mechanism is Backed's own confirmed behavior (§3.1), the demo's collateral is wNVDAx (real liquid asset) possibly via a testnet-mocked instance (§4), and the full desk (Multiply, LP, tiers, agent policy, CF Benchmarks integration) is named, evidenced roadmap — not conflated with what's built.
- Acknowledgment of Corporate Action Guard as a reference pattern, not a silently-copied, unattributed project.
- No claim that mainnet-readiness is proven if the submitted build is testnet-only.

---

## 10. Judging criteria mapping

*(Caveat: the specific weighting below is not officially confirmed — see §7 — this maps the build to the general categories named on the event page and to "working products, not pitch decks," which is confirmed.)*

| Category | What in this build serves it |
|---|---|
| **Working product / Completion** | §8's Day-3 halt-gated borrow/repay loop — verifiable onchain state, not a mocked screenshot. |
| **Technical depth / Innovation** | §3.1's oracle-pause mechanism, confirmed as Backed's own behavior and correctly generalized to both raw and wrapped xStocks — not a generic "RWA lending" pitch. |
| **Market relevance** | §1's confirmed real liquidity (USDG/wNVDAx pool) and confirmed zero-collateral gap on Aave X Layer — a real, evidenced gap, not an asserted one. |
| **Demo clarity** | The OPEN→HALTED→RESUMING toggle walkthrough is a natural, visual demo moment — plan for it explicitly, video or live. |

---

## 11. v2 build plan — feature additions (post-v1, not hackathon-scoped)

v1 (§4) is deliberately narrow: single-market borrow/repay, one collateral asset, no leverage. Four additions come next, built and shipped one at a time — each fully tested and deployed before the next starts, not in parallel. No deadline drives this; sequencing is purely by risk to the audited core. Status as of 2026-09-18: none started; v1 is live and verified on testnet (§9's criteria all met).

All four plug into the existing app — none of them replace or restructure `Market`, `LenderVault`, or the halt state machine. Two are new optional actions layered on top (leverage); one is a new borrowing *option* alongside the existing one (fixed-rate); one widens the app from one market to several, reusing the same contracts. The current supply/borrow/repay flow keeps working unchanged throughout.

**Build note that applies from Milestone 1 onward:** even though only one market (wNVDAx/USDG) exists until Milestone 4, `LeverageZap` and the Milestone 3 fixed-term position tracking should both take a **market address as a parameter** from the start, not assume a single hardcoded market. Building this in from Milestone 1 avoids retrofitting the periphery/core contracts later when Milestone 4 adds more markets — the cost of designing for it now is near zero, the cost of bolting it on after is a re-audit of both contracts.

### Milestone 0 — SwapModule (shared prerequisite for Milestones 1–2) — ✅ done, 2026-09-18
Internal oracle-priced wNVDAx↔USDG swap — no real DEX has liquidity for the mock testnet token, so this stands in for one.
- [x] Contract: swap priced off the existing oracle, with a fee/spread. `src/periphery/SwapModule.sol` — bidirectional (`swapDebtForCollateral`/`swapCollateralForDebt`), fee confirmed at **0.30%** (`MAX_FEE` hard ceiling 5%), owner-adjustable inventory via `withdrawInventory`.
- [x] Gate it on `HaltController.canSupplyOrBorrow()` — no swapping into more exposure while the market is halted. Plus an independent oracle-freshness check (mirrors `Market._requireFreshPrice`) so a direct oracle pause can't be swapped against even before `HaltController.sync()` reflects it.
- [x] Tests: 14/14 passing (`test/periphery/SwapModule.t.sol`) — pricing correctness both directions, fee application, halted-market revert, oracle-paused-directly revert, stale-oracle revert, insufficient-inventory revert, 6-decimal debt token correctness, fee-cap governance. Slither clean (one divide-before-multiply finding, fixed by combining into a single multiply-then-divide expression, same pattern already used in InterestRateModel/Market).
- [x] Governance: owner = multisig directly, no timelock (confirmed tier — fast to tune during active feature development, still gated behind the multisig rather than a bare key).
- [x] Deploy to testnet, verify wiring. Deployed `0x7b04e499a1D596D9B5ED3B80EAa2d17d0d10B7A2`, seeded with 40 wNVDAx from the deployer's own balance (60 wNVDAx kept back for other testing). Wired into `frontend/lib/contracts.ts` and `wagmi.config.ts`; hooks regenerated.

### Milestone 1 — Leverage Zap (single-loop "buy more in one click") — ✅ done, 2026-09-18
- [x] New periphery contract `LeverageZap.sol`: one atomic transaction — supply collateral → borrow USDG → swap it for more wNVDAx via SwapModule → supply that too. Stateless, market-aware via call parameters (not fixed at deploy), so it stays usable once Milestone 4 adds more markets.
- [x] **Plan correction found mid-build, not periphery-only after all:** `Market.supply()`/`borrow()` are hardcoded to `msg.sender`, so a periphery contract calling them directly would have credited itself, not the user -- a fund-losing bug, caught before writing `LeverageZap` rather than after. Fixed properly (confirmed with the user) by adding operator delegation to `Market.sol`: `isOperator` mapping, `setOperator()` (revocable, self-service, same idea as an ERC20 approve), and `supplyFor()`/`borrowFor()` sitting alongside the existing `supply()`/`borrow()` (refactored into shared `_supply()`/`_borrow()` internals so both paths can't drift). This *did* require redeploying Market + LenderVault together, same as every prior core change.
- [x] Tests: 14 new `Market.Operator.t.sol` tests (delegation grant/revoke, unauthorized-caller revert, cash-to-caller/debt-to-onBehalfOf attribution, halted-market revert, maxLTV enforcement) + 9 new `LeverageZap.t.sol` tests (happy path, zero-initial-collateral amplify-existing-position path, unauthorized revert, halted-market revert, maxLTV revert, slippage revert, mismatched-SwapModule revert, insufficient-inventory revert, exact event amounts). Slither clean throughout (only pre-existing, already-reviewed findings in OZ library code and Market's own prior strict-equality guards -- nothing new).
- [x] Frontend: "Leverage" tab in `DashboardTabs` — one-time "Enable Leverage" authorization step, amount input, an intensity slider (0-100% of available borrowing power), live preview of resulting collateral/debt/health factor computed client-side with the exact same math as the contracts, single confirm.
- [x] Deployed and verified live on testnet: redeployed `Market` (`0xBE4e22F15375764A001F57533AB7DC179513111e`) + `LenderVault` (`0x618F436c5a641AfE60Ddc6b7a5bee10019B716d5`, same immutable-reference cascade as every prior core fix), recovered and redeposited the 103 USDG LP position, deployed `LeverageZap` (`0xA214c1E9b4CC3b52525A75c6DD6fcD68c7D39763`). Live round-trip: supplied 5 wNVDAx + borrowed 50 USDG + swapped + re-supplied in one transaction, confirmed the position landed on the user (not the zap, which held zero leftover balance or position afterward) -- then triggered a real halt via the multisig, confirmed `leverage()` reverts with `MarketHalted`, resumed, confirmed it works again.

### Milestone 2 — Multiply (pick a target multiple) — ✅ done, 2026-09-18
- [x] Extended `LeverageZap` with `multiply(market, swapModule, initialCollateralIn, targetLeverageWad, minFinalCollateral)` — loops borrow→swap→supply until the position reaches the target multiple. `leverage()` (single pass) and `multiply()` (looped) share one internal `_loopOnce()` so the two paths can't drift, the same discipline used for `Market._supply`/`_borrow`.
- [x] Hard-capped at `MAX_LEVERAGE = 5e18` in the contract, not just the UI, plus a `MAX_ITERATIONS = 10` gas bound.
- [x] **Resolved the open design question: stop early, don't revert.** At a 50% maxLTV the theoretical ceiling is `1 / (1 - maxLTV)` = 2x — an *asymptote* no finite number of loops ever actually reaches, so "revert unless the target is hit exactly" would reject perfectly reasonable requests. Each pass is instead capped by the position's live LTV headroom and the vault's liquid cash, and `minFinalCollateral` is the caller's real protection: the whole transaction reverts if the result lands below it. Each pass also rounds its borrow so it never *overshoots* the requested multiple, which would silently hand the caller more risk than they asked for.
- [x] Tests: 16 new in `LeverageZap.Multiply.t.sol` — target accuracy at 1.2x/1.5x, no-overshoot, graceful stop at the 2x asymptote (lands ~19.x of 20 and is *not* liquidatable), early stop on thin vault liquidity, `minFinalCollateral` revert, `InvalidLeverage` above `MAX_LEVERAGE` and at/below 1x, halt revert, unauthorized revert, mismatched-SwapModule revert, position-integrity/no-residue, and the loop-count event. All 231 tests pass.
- [x] Slither: one flagged divide-before-multiply in `_nextBorrow` is **deliberate and documented** — the headroom figure mirrors `Market._collateralValueWad`→`_maxBorrowableNative` step for step, because collapsing it would be *more* precise and therefore wrong: rounding even one wei above Market's own figure makes the next `borrowFor()` revert with `ExceedsMaxLTV` and kills the loop. Remaining findings are the pre-existing accepted classes (strict-equality-on-zero guards, tuple-destructuring unused returns).
- [x] Frontend: the intensity slider is replaced by a target-leverage slider (1.05x up to 95% of the market's own theoretical ceiling, derived live from `maxLTV` rather than hardcoded, so it stays correct if the risk parameter changes). Live preview of resulting collateral/debt/health factor, plus an explicit warning when thin vault liquidity means the loop will stop short instead of reverting.
- [x] Deployed `LeverageZap` (`0xfCB4A5C042fE54e04A7F9027992f06F40F4F55be`) and verified live on testnet: a 1.05x target against a 10.332833 wNVDAx base produced **10.848950003** wNVDAx against a target of 10.848950000 — a 3-billionths-of-a-token overshoot from the deliberate round-up — with debt +93.27 USDG, health factor 7.0, not liquidatable, and zero position or token residue left in the zap.
- [x] Note: redeploying the zap changes its address, so `setOperator` authorizations granted to the previous one don't carry over — users re-authorize once via the panel's "Enable Leverage" step.

### Terminal-halt settlement — ✅ done, 2026-09-18
Not one of the numbered milestones: this was the council's outstanding item #2 from the Offerbook review, and it closes a hole in the core thesis rather than adding a feature beside it. A halt froze LP redemptions with **no time bound at all** — so the mechanism that exists to protect lenders through a corporate action could itself strand their capital indefinitely if the oracle never resumed or the keeper never called `completeResume()`. "What happens if the halt never ends?" had no answer.

- [x] **A clock.** `haltStartedAt` is set the moment the market leaves OPEN and deliberately does *not* restart across HALTING → HALTED → RESUMING — it measures how long capital has been restricted, not how long any one phase lasted. Restarting per-phase would let a market cycle between them forever and never become settleable, which is precisely the failure being ruled out. Cleared on return to OPEN.
- [x] **A fifth state, `SETTLING`**, reachable via a **permissionless** `forceSettle()` once the market has sat outside OPEN for longer than `settlementDelay`. Permissionless on purpose: a guarantee that depends on the same governance that let the market get stuck isn't a guarantee. Callable from HALTING, HALTED and RESUMING alike, since capital is restricted in all three.
- [x] **Settlement releases capital pro-rata, not first-come-first-served.** This is the crux. Simply lifting the freeze after a timeout would hand back the exact bank run the freeze exists to prevent — early movers draining cash at a stale share price while latecomers absorb the bad debt. Instead `LenderVault.maxRedeem` caps each holder at their *proportional slice of cash on hand*. Because everyone redeems at the same price and draws exactly their proportion, cash and supply fall in step and the share price is left arithmetically unchanged — so moving first earns no better rate, only earlier access to a slice that was already yours, and any eventual loan impairment is borne proportionally by whoever still holds shares.
- [x] **Not a dead end.** A settled market whose oracle recovers still syncs to RESUMING and back to OPEN normally. `sync()` explicitly refuses to drag SETTLING back to HALTED, which would permissionlessly re-trap the capital settlement just released.
- [x] **Governance can retune the delay but never revoke the guarantee.** `settlementDelay` (default 7 days) is bounded by `MIN_SETTLEMENT_DELAY` = 1 day and `MAX_SETTLEMENT_DELAY` = 30 days. The floor stops governance setting it near zero and letting anyone stall an ordinary corporate-action halt; the ceiling stops governance quietly restoring the indefinite lockup by pushing the deadline out. Both bounds are load-bearing.
- [x] Interest stays frozen through SETTLING for the same reason it freezes during HALTED (§6 edge case 5) — the price is still unresolved and liquidation is still off, so charging interest would push borrowers toward a liquidation they can't defend against. Both freeze sites in `Market` now read a single `HaltController.interestFrozen()` rather than duplicating the condition.
- [x] Tests: 30 new (20 state-machine in `HaltController.Settlement.t.sol`, 10 pro-rata in `LenderVault.Settlement.t.sol`). The two that matter most assert the fairness property directly: identical assets-per-share regardless of redemption order, and share price held flat through a pro-rata exit. 261 total passing. Slither clean on HaltController; the one new LenderVault finding is a `supply == 0` division guard, the accepted class.
- [x] Redeployed the full cascade — HaltController (`0x4C4AC6fd104Eb8CE9887a0e7Da757f86d08EE807`), LenderVault (`0x0051f29d5E2BFC85542266a3B9894Da2db2aDf4d`), Market (`0x3ff6a0071655B1179C64f7114b175B141af91978`), SwapModule (`0x3797E011686e756EFfb8619B5faDCE261BA59680`); `LeverageZap` is stateless and survived unchanged. All positions on the previous stack were unwound first so no testnet USDG was stranded.
- [x] Live-verified on testnet: clock starts on halt with `settlementAvailableAt` exactly 604,800s out, `interestFrozen` true, `maxRedeem` 0 while halted, and `forceSettle()` correctly rejected as premature with `HaltTooRecent(1790347245)` naming the exact deadline. Resume cleared the clock and restored `maxRedeem`.
- [x] Frontend: once the deadline passes, the halt banner's countdown becomes an "Open settlement" button any connected wallet can press, with copy making clear it's permissionless and unlocks withdrawals for every lender at once. Before the deadline it stays a countdown. Without this the guarantee only reached lenders who could send raw contract calls.
- [ ] **Not yet demonstrated on-chain:** the post-deadline transition itself, because the floor on `settlementDelay` is 1 day and live chains can't be time-warped. That path is covered by the 30 tests rather than a mainnet-style demo; verifying it live means either waiting out a real halt or accepting a testnet-only lowered floor, which would weaken the safety property and was deliberately not done.

---

### Milestone 3 — Fixed-Rate Borrow Without Liquidation (new loan type, not a replacement) — ✅ done, 2026-09-19
The larger addition, and the only milestone here that touches `Market`'s core risk logic rather than sitting beside it. A second loan type where **maturity replaces liquidation**: the position cannot be closed out on price at any point during the term, however far the stock falls.

- [x] **Design decisions, all confirmed before writing code:**
  - The new position type lives inside the existing `Market`/`LenderVault` and draws on the same pool liquidity, rather than a separate isolated contract. Fragmenting liquidity across two contracts to serve one market would have made both sides worse.
  - **The maturity clock keeps running through a halt.** The plan floated pausing it to mirror the interest freeze, but the two are not analogous: freezing interest stops the protocol *charging* for a window the borrower cannot act in, whereas freezing maturity would extend a lender's capital lockup by exactly the halt duration with no compensation. Repayment stays open during a halt, so the borrower is never actually prevented from acting. What *is* suspended is `settleMatured()`, gated on `canLiquidate()` so a halt cannot be the moment the protocol claims collateral.
  - **Settlement seizes the whole collateral and reads no price.** The plan originally said "at a fixed conversion rate," which on inspection reintroduces the oracle dependency this loan type exists to eliminate: a frozen or stale price would block settlement precisely when it matters most. Seizing everything is deliberately blunt; the borrower's protection is the low LTV, not a partial claim.
  - **Confirmed against the reference implementation rather than assumed.** Checked Jupiter Offerbook's docs directly after the fact, and the behaviour matches on every point that matters: the claimant takes the **entire** collateral (*"the lender can claim the entire collateral at any time by signing a transaction"*), the transfer is **not automatic** (*"it only happens when the lender claims"*), there is **no grace period** but the borrower can still repay right up until the claim lands (*"the borrower can still repay until the lender claims"*), and terms run **1 to 30 days**. All four are what `settleMatured()` / `repayFixed()` / `MIN_FIXED_TERM` / `MAX_FIXED_TERM` already did. Two deliberate divergences: Offerbook restricts the claim to the named lender, which a pooled market has no equivalent of, so `settleMatured()` is permissionless; and Offerbook skims 0.1% of the seized collateral as a protocol fee, which HaltGate does not.
  - **The other family of fixed-rate protocols was considered and rejected.** Notional and Term Finance are pooled fixed-rate lenders, structurally much closer to HaltGate than Offerbook is, and they settle maturity defaults completely differently: a third party buys *a portion* of the collateral at a discount to the on-chain oracle price, clears the debt, and the borrower keeps the rest. That is materially fairer to the borrower and it is exactly what HaltGate cannot do, because it requires a trustworthy price at the moment of settlement and the whole halt thesis is that such windows exist where no trustworthy price does. Taking Offerbook's price-free rule into a pooled market is the unusual choice here, and it is the deliberate one.
  - **`LenderVault.totalAssets()` counts fixed principal but not fixed interest.** Booking unearned interest into the share price would let a lender deposit late, redeem early and collect on a loan that had not paid. Interest lifts the share price at the moment `repayFixed()` actually delivers it.
  - **Fixed-term LTVs are tiered per asset, all below the 50% variable cap.** Two separate reasons, and the structural one is the stronger:
    1. **Losses are socialized, so the borrower cannot be the one choosing the risk.** Offerbook's own docs work through a **70% LTV** example, roughly double anything here. That is defensible there because Offerbook is peer-to-peer: the lender who posts a 70% offer is risking their own capital and picked that number themselves. In a shared pool a default is absorbed by every depositor, none of whom chose the LTV, so the cap has to be set by governance and set conservatively. Whole-collateral seizure is only fair when the loan is small relative to what backs it, and 70% against a socialized pool would not be.
    2. **Nothing can close the position out early.** A liquidatable position gets closed at the first sign of trouble; a fixed-term one has to survive the entire term untouched, so an identical cap carries materially more risk than the variable market's.
    The ordering between assets then comes from how far each realistically moves over a 30-day window: **TSLA 30%, NVDA 35%, AAPL 40%, MSFT 40%, SPY 45%** (a diversified index, not a single name). Rate is **8%/yr simple** on all five; terms **1 to 30 days**, offered as 1 / 7 / 14 / 30.
  - Sources checked: [Offerbook docs](https://docs.jup.ag/user-docs/earn/offerbook), [Notional on settlements and liquidations](https://blog.notional.finance/understanding-liquidations/).
- [x] **Follow-up found by checking the reference, not by testing: a settlement bounty.** `settleMatured()` was permissionless but paid the caller nothing, since the collateral goes to the protocol. Offerbook gets that alignment for free because the lender both claims and keeps the collateral; translating it to a pool kept the permission and dropped the incentive. The consequence was real: nobody had a reason to spend gas closing a defaulted loan, so it could sit unsettled while `totalAssets()` went on counting it at full face value, letting LPs who exit during that window take value from LPs who stay.
  - `settlementBounty` (WAD) pays the caller a share of the seized collateral, set to **0.5%**, hard-capped at `MAX_SETTLEMENT_BOUNTY = 2%`. Denominated in collateral tokens rather than dollars, so paying it reads no price and the loan type keeps its oracle independence through settlement.
  - The cap is deliberately far below the 5% `liquidationBonus`, asserted in a test: a liquidator fronts the debt, a settler fronts only gas, so paying them alike would make settling the more profitable action.
  - Separate `setSettlementBounty()` rather than a third argument to `setFixedParams()`, so an incentive can be retuned without touching risk limits. Defaults to 0, which is the safe failure mode: forget to set it and behaviour is exactly what it was before, with no funds at risk.
  - Effects before interaction (`delete` the loan, decrement `totalFixedPrincipal`, credit `seizedCollateral`, then transfer), under the existing `nonReentrant`. Slither flags nothing on the function.
  - 9 new tests: bounty paid, default-zero pays nothing, exact conservation of the split on a deliberately non-round rate, dust collateral rounding to zero without reverting, the event carrying bounty and retained separately, cap enforcement at and above the ceiling, owner-only, and the cap-below-liquidation-bonus invariant. **292 tests, all passing.**
  - **Left open and documented rather than hidden:** `totalAssets()` counts fixed principal but not `seizedCollateral`, so the share price dips between settlement and governance converting that collateral, then recovers above its starting point. Closing it means valuing the collateral, which is the oracle dependency the whole loan type exists to avoid. The bounty shrinks the window by making settlement prompt; it does not remove it.
- [x] Contracts: `FixedLoan` struct plus `borrowFixed()` / `repayFixed()` / `settleMatured()` / `quoteFixed()` / `isFixedDefaulted()` / `withdrawSeizedCollateral()` in `Market.sol`, entirely separate accounting from the variable-rate path (`totalFixedPrincipal`, `seizedCollateral`). `setFixedParams()` reverts if the fixed LTV is ever set at or above the variable `maxLTV`, so the invariant is enforced on-chain rather than by convention. One loan per address at a time, which keeps maturity unambiguous.
- [x] Tests: 22 new in `test/core/Market.FixedTerm.t.sol` — origination and quote accuracy, on-time repay, repay-during-halt, the LTV ceiling, term bounds, one-loan-at-a-time, maturity default and whole-collateral seizure, settlement blocked during a halt, `totalAssets` before/after repayment, and variable-rate position independence. **283 tests across 23 suites, all passing.** Slither shows only the pre-existing accepted strict-equality-on-zero class.
- [x] Frontend: new **Fixed** tab in `DashboardTabs` alongside the variable-rate Borrow flow, both available side by side. Term selector, live `quoteFixed` preview of the exact total repayable at maturity, per-market LTV cap surfaced in the input, a countdown and a past-due state on the open loan, and copy that states the no-liquidation tradeoff in both directions. `settleMatured()` is surfaced in the **Liquidate** tab, which is where the third-party keeper role already lives.
- [x] Redeployed Market + LenderVault for all five markets via a new `script/UpgradeMarket.s.sol` (reuses the existing oracle, HaltController, collateral and SwapModule — only the pair with the immutable cross-reference has to move). All positions unwound and all five vaults drained beforehand, 102.999937 USDG recovered and re-supplied afterward.
- [x] **Verified live on testnet, not just in tests.** Full round trip on NVIDIA: 2 wNVDAx locked, 10 USDG borrowed for 7 days, quoted 10.015342 owed and that is exactly what was stored. Confirmed on-chain that a second loan reverts `LoanAlreadyOpen`, a 1-hour term reverts `InvalidTerm`, and early settlement reverts `NotMatured`. After `repayFixed()`: loan cleared, collateral fully returned, `totalFixedPrincipal` back to zero, market holding zero collateral, and the 0.015342 interest visible in the share price (42,000,000 shares redeeming 42.015341). The variable-rate position stayed at zero throughout, confirming the two accounting paths are genuinely independent.
- [x] Side finding: all five mock oracles had drifted past the 24-hour staleness window, which blocks borrowing protocol-wide. Refreshed through the multisig. Noted in the README as a demo operational requirement rather than a bug.

### Milestone 4 — Multi-Market Support — ✅ done, 2026-09-18
Five isolated markets live: **NVIDIA, Tesla, Apple, Microsoft, S&P 500 ETF**. Halting one now demonstrably leaves the other four trading, which is the only way to actually *prove* halts are per-asset rather than protocol-wide.

- [x] Design decisions confirmed as planned: liquidity stays isolated per market (each has its own `LenderVault`), every market gets its own independently-pausable oracle and `HaltController`, and `InterestRateModel` + `LeverageZap` are shared — the rate curve is stateless and the zap already took its market as a call parameter, exactly as the Milestone 1 build note intended.
- [x] Contracts: **no new protocol logic**, as planned. One change was needed though — `MockWrappedXStock` hardcoded NVIDIA's name and symbol, so five markets would all have shown up as `wNVDAx-MOCK` in wallets and explorers. Constructor now takes name/symbol; all 19 existing call sites updated to preserve behaviour, 261 tests still pass.
- [x] New `script/DeployMarket.s.sol` deploys one complete isolated stack (token, faucet, oracle, HaltController, LenderVault, Market, SwapModule), wires it, stocks the faucet and swap inventory, and applies the same governance split as the first market (multisig owns the fast levers, timelock owns the rest). Repeatable — adding a sixth stock is one command.
- [x] **The frontend was the real work, and the plan understated it.** "No new Solidity, mostly a market selector" was only half right: 75 references across 10 components read a module-level `CONTRACTS` singleton, so a dropdown on top would have changed nothing. Replaced with a market registry plus a `MarketProvider` context. Because `useMarketContracts()` returns the *same shape* the old constant had, each component changed by one line rather than rewriting all 75 references.
- [x] New `MarketsTable` modelled on Kamino's isolated-market lending table (researched, not guessed: asset / rates / utilization, with a persistent position summary above). It carries one column Kamino has no need for — **halt status** — which is what makes the thesis legible at a glance. Rates render as `--` on a halted market rather than showing a live-looking APR that interest has actually frozen.
- [x] Deployed and funded: 103 USDG of real testnet liquidity split across the five vaults (43 NVDA / 15 each), 200 collateral tokens of swap inventory and 1,000 of faucet supply per market. All five verified OPEN and correctly wired against the frontend registry, entry by entry.
- [x] **Isolation verified live, not just asserted.** Halted NVIDIA via the multisig, then confirmed on-chain: NVDA `state=2, canSupplyOrBorrow=false` while TSLA/AAPL/MSFT/SPY all stayed `state=0, canSupplyOrBorrow=true`. Went further than state flags and executed real actions — a supply *and* a borrow on Tesla both succeeded while NVIDIA was halted, and a supply on NVIDIA reverted `MarketHalted` in the same window. Resumed; all five markets back OPEN.
- [ ] Optional: a third-tier demo with more than five stocks. Trivial now — one `DeployMarket` run plus a registry entry. Gas is not a constraint (a full stack costs ~0.00016 OKB); USDG liquidity is, since it comes from the Paxos faucet.

**Why this order:** Milestones 1–2 are additive and periphery-only — they can't break the audited core, and they reinforce the halt thesis directly ("can't lever up during a halt"). Milestone 3 is the real structural differentiator but carries the most design and testing risk, so it comes after the lower-risk wins are shipped and demoable. Milestone 4 was taken before Milestone 3 in the end: its frontend refactor is a prerequisite either way, so doing it first means the fixed-rate UI gets built once, multi-market-aware, instead of built single-market and retrofitted.

---

### Per-market detail pages, modelled on Kamino — ✅ done, 2026-09-19

Decided 2026-09-18 from screenshots of Kamino's live Earn / Borrow / Multiply pages and their detail views. Recorded here rather than built, so the decisions don't have to be re-derived.

**What the screenshots settled.** Kamino routes to detail pages (breadcrumb + back arrow), it does not use modals. Three things already built here independently match theirs: the interest-rate-vs-utilization chart, a leverage slider bounded *below* the theoretical max (they show "Max Leverage 2.9x" but cap the slider at 2.7x), and collapsible per-market rows whose header carries collateral / debt / borrow APY / market size. Worth noting they also treat **xStocks as a first-class filter category**.

**Adopt:**
- [x] `/app` as markets index, `/app/[market]` as detail page, with breadcrumb and back.
- [x] A **persistent five-market status strip** in the header on every page. Routing would otherwise hide the "NVDA halted while borrowing TSLA" moment, which is the whole reason five markets exist.
- [x] Detail skeleton from their reserve page: header (name, price, halt badge, oracle), stat row, `Overview | My Position` tab split, sticky right-hand action sidebar with Half/Max.
- [x] Add **Liquidity Available** as a headline stat. It's the actual binding constraint here — 15 USDG per market is what stops a leverage loop — and it's currently buried.
- [x] Promote `RateCurveChart` out of the sidebar onto the detail page, where Kamino's equivalent sits.
- [x] **Asset Details** section: market, vault, oracle, collateral and swap-module addresses, each linked to OKLink. Kamino uses this slot for websites and audits; for a testnet submission it does something more useful — lets a judge verify every claim on-chain in one click.

**Replace rather than copy.** Kamino fills detail pages with utilization history. The same space here should hold a **Halt & Settlement panel**: current state, time in state, what's allowed vs blocked right now, interest-freeze status, settlement countdown and trigger — plus **halt history reconstructed from `StateChanged` events**, which is the one piece of genuine history this protocol has and the direct analogue of their utilization chart.

**Deliberately not adopting**, because each needs data that doesn't exist here or implies mechanics that weren't built: historical APY / utilization / price charts, 30D-90D-180D averages, interest-generated totals, Proof of Reserves, curators and risk managers, vault profiles, management and performance fees, soft liquidations, borrow caps, borrow factor, benchmark APY. Kamino's pages are dense because Kamino has $2.6B and months of history; this has five markets, days old, ~$103 of testnet liquidity and mock prices. Flat lines and empty sections read worse to a judge than a tighter page.

**One deliberate divergence.** Kamino's top nav is product-first (Earn / Borrow / Multiply across all markets). Stay **market-first** — pick a stock, then act. They have 35 markets so product-level entry points are necessary wayfinding; with five that's an extra hop for nothing, and market-first keeps halt status at the top of the hierarchy where the differentiator lives.

**Built 2026-09-19.** All five markets prerender as static routes (`/app/nvda` … `/app/spy`); an unknown key 404s. Verified each route renders its own market by checking both the `<h1>` and the first contract address in its Contracts panel against the registry — proving routing resolves through to the on-chain reads, not just the heading.

Two things the build caught that are worth recording:
- `params` is a **Promise** in this Next.js version and must be awaited. The project's own `AGENTS.md` warns that this version has breaking changes; reading `node_modules/next/dist/docs/` first is what avoided a silent break.
- The faucet is per-market, so `TestnetTools` couldn't sit on the market **index** (no market in scope — the prerender failed on it). Moved to the detail sidebar, which is the better home anyway: you claim a stock's collateral on that stock's page.

Also fixed a real bug while here, not just lint: `Date.now()` was being read during render for the settlement countdown, so it only updated when an unrelated query happened to re-render the component. Replaced with a `useNow()` timer hook in both the panel and the halt banner.

**Not carried over:** the old single-page dashboard is gone; `MarketsTable` rows are links rather than selection, and `useSelectedMarket` was dropped as dead once nothing selected in place.

---

## 12. Mainnet migration path

Everything in §4 and §11 targets X Layer testnet. Migration to X Layer mainnet is a **migration, not a rebuild** — same zkEVM architecture, same Solidity — but several components were deliberately mocked for testnet and need real rework, not just a redeploy with new constructor args.

Revised 2026-09-18 after §3.4 was resolved: the oracle work is substantially larger than this section first assumed. It is not an address swap — Data Streams' pull-based model means price ingestion has to be rebuilt, not repointed.

**Carries over unchanged (redeploy only):** `Market.sol`, `LenderVault.sol`, `InterestRateModel.sol`, `HaltController.sol` state machine, `Multisig.sol`/Timelock mechanics, and the Phase 1–3 additions above once built.

**Needs real rework before mainnet:**

| Component | Testnet (current/planned) | Mainnet requirement |
|---|---|---|
| Price ingestion | Mock contract with a readable `latestPrice()` | **Chainlink Data Streams on X Layer mainnet — pull-based, so there is no contract holding a current price to read (§3.4).** Every price-dependent path (`borrow`, `liquidate`, `SwapModule`) needs a caller-supplied signed report verified on-chain. The largest single piece of mainnet work, and bigger than §12 originally implied. |
| Halt signal | Multisig manually calls `pauseOracle()`/`resumeOracle()` on a mock | No feed exposes a pause flag (§3.4) — detection is via `updatedAt` staleness, which `_requireFreshPrice()` already does. **But staleness cannot distinguish a corporate action from a weekend**, so this needs the CF Benchmarks CA feed or a market-hours calendar. This is the product's core IP and the real design work. |
| Collateral token | `wNVDAx` mock ERC20 with a faucet | Real xStock token from the actual issuer (Backed) — different custody/redemption trust assumptions, no faucet. |
| `SwapModule` (§11) | Internal oracle-priced swap (no testnet DEX liquidity) | Route through a real DEX/aggregator if liquidity exists (§3.2's confirmed ~$588K TVL Uniswap pool) — an internal fixed-price swap holding real money is a manipulation vector. |
| Risk parameters | Demo defaults (LTV, liquidation threshold, rate curve, reserve factor) | Re-derived from real volatility/liquidity data before real TVL sits behind them. |
| Governance signers | Test EOAs | Real multisig signers/threshold. |
| Audit | Foundry tests + Slither self-review | Third-party audit expected before real funds, given lending + liquidation + (post-Phase-3) fixed-term settlement logic. |

Matches the caution already in §6 edge case 8 and §9's success criteria: no claim of mainnet-readiness until every assumption above is independently re-verified against real contracts.
