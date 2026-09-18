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

### 3.4 One remaining open item — not blocking, worth 15 minutes before Day 1

Whether a **live Chainlink price feed contract for wNVDAx is actually deployed and queryable on X Layer specifically** (mainnet or testnet) is not yet confirmed — only that Chainlink is xStocks' oracle infrastructure *in general*. Check this directly (Chainlink's feed registry / X Layer docs) before committing the halt trigger to read a live feed. If no live feed is reachable, the fallback is identical in design intent: a mock oracle contract replicating the confirmed `pauseOracle()` state machine, keyed to the same real, confirmed CA activation timing (00:30 UTC day after Ex-Date) — not a compromise, just a substitution of data source.

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
| 2 | Live Chainlink feed for wNVDAx on X Layer unconfirmed | Resolve before Day 1 (§3.4, §8); fallback is a mock oracle keyed to the same real CA timing — not a design compromise. |
| 3 | Corporate Action Guard's gate model doesn't match HaltGate's oracle-pause trigger | Reference its pattern, don't force a direct dependency — its receipt/schedule model and HaltGate's oracle-state model solve the same class of problem differently. |
| 4 | Liquidation math untestable against a real CA event in a 9-day window | Use the CA-timing toggle to simulate a halt/resume cycle for the demo; don't claim mainnet-readiness is proven. |
| 5 | Interest accrual during halt | Freeze the interest index during HALTED — disclose this rather than silently accruing. |
| 6 | Admin/multisig force-resume misuse | Accept explicitly for hackathon scope; document via a named timelock, not an unbounded owner key. |
| 7 | Wrong collateral address wired in | Immutable per-market whitelist set at deploy. |
| 8 | Mock asset/oracle diverges from real xStocks/Chainlink semantics in an undiscovered way | Flag in the pitch that mainnet deployment requires re-verifying every assumption in §3 against the real contracts before real funds are at risk. |
| 9 | Team pursues the mainnet stretch demo (§4) and a real CA event or oracle hiccup occurs live | Have a manual pause/kill-switch path ready before attempting a mainnet demo — do not rely solely on automated triggers for a live public demo with real funds. |

---

## 7. Open risks / unverified dependencies

- **Live Chainlink feed reachability for wNVDAx on X Layer** (§3.4) — the one real remaining technical unknown; resolve before Day 1, fallback already designed.
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

### Milestone 2 — Multiply (pick a target multiple, e.g. "3x")
- [ ] Extend `LeverageZap` with a target-leverage parameter — loops the borrow→swap→supply cycle until that multiple is reached.
- [ ] Hard-cap max leverage in the contract itself, not just the UI (e.g. 5x).
- [ ] Decide and implement: if a loop step would breach the safe LTV margin, does the whole transaction revert, or does it stop early at the last safe multiple?
- [ ] Tests: accuracy at 2x/3x/5x, revert beyond the cap, revert (or safe stop) on any step breaching LTV.
- [ ] Frontend: leverage slider (1x–5x) on the same tab, live health-factor preview as it moves.
- [ ] Deploy, verify live on testnet.

### Milestone 3 — Fixed-Rate Borrow Without Liquidation (new loan type, not a replacement)
The larger addition — this one does touch `Market`'s core risk/settlement logic, unlike Milestones 1–2.
- [ ] Confirm design decisions before writing code:
  - New position type lives inside the existing `Market`/`LenderVault` (shares the same pool liquidity) rather than a separate isolated contract.
  - During a halt, does the loan's maturity countdown pause (mirroring how interest already freezes for variable-rate debt), or keep running?
  - At maturity, an unpaid loan settles by the pool claiming collateral at a fixed conversion rate — no price-based liquidation involved, by design.
  - `LenderVault.maxRedeem()`'s halt-gate needs to account for capital locked in unmatured fixed-term loans too.
- [ ] Contracts: new position tracking in `Market.sol` plus `borrowFixed()` / `repayFixed()` / `settleMatured()`, separate from the existing variable-rate path.
- [ ] Tests: origination, on-time repay, halt-during-term (clock pause), maturity default/seizure, impact on LP withdrawals.
- [ ] Frontend: new "Fixed" tab alongside the existing variable-rate borrow flow — both remain available side by side.
- [ ] Redeploy Market + LenderVault together (core logic change — same immutable-reference cascade as every prior core fix), verify wiring on testnet.

### Milestone 4 — Multi-Market Support (more than one collateral token)
Right now, halting "the market" doesn't prove halts are *per-asset* — there's nothing else running to contrast it against. Deploying a second (and ideally third) full market for a different xStock (e.g. wTSLAx, wSPYx) lets the demo show one stock halted for earnings while another keeps trading normally, side by side — a materially stronger demonstration of the core thesis than a single on/off toggle.

- [ ] Confirm design decisions before starting:
  - Debt token stays shared (USDG) across markets, but liquidity is **not** pooled across them — each market keeps its own isolated `LenderVault`, matching the existing Compound-v2-style isolated-market pattern already in place. Tradeoff to accept explicitly: LP liquidity is fragmented per market, not aggregated into one shared pool (aggregating would be a materially larger change — out of scope here).
  - Each market gets its own oracle instance, independently pausable — this is what makes isolated halting demonstrable at all.
  - Confirm `LeverageZap` (Milestone 1) and the fixed-term position logic (Milestone 3) already accept a market parameter per the build note above — if they don't yet, generalize them here before adding new markets, not after.
- [ ] Contracts: **no new Solidity logic.** Reuse `Market.sol`, `LenderVault.sol`, `HaltController.sol`, `InterestRateModel.sol`, and the `WNVDAxFaucet.sol` pattern (generalized/parameterized) unchanged — this milestone is deployment and wiring work, not new contract design.
- [ ] New assets: mock collateral token + faucet for at least one additional xStock (e.g. wTSLAx); a second (e.g. wSPYx) if time allows, for a 3-market demo.
- [ ] Deploy a full second stack (oracle + HaltController + InterestRateModel + LenderVault + Market) per new asset, reusing the existing deploy-script pattern.
- [ ] Tests: halting Market A does not affect Market B's supply/borrow/liquidate availability; each `LenderVault.maxRedeem()` gate reads only its own market's `HaltController`, never another market's.
- [ ] Frontend: market selector (dropdown or tabs), each market with its own dashboard view and its own halt-status banner; Leverage/Multiply/Fixed-Rate tabs become market-aware instead of assuming wNVDAx.
- [ ] Deploy to testnet, verify wiring, then verify isolation **live**: halt Market A via the multisig, confirm Market B's state and actions are entirely unaffected — this is the actual demo moment this milestone exists for.

**Why this order:** Milestones 1–2 are additive and periphery-only — they can't break the audited core, and they reinforce the halt thesis directly ("can't lever up during a halt"). Milestone 3 is the real structural differentiator but carries the most design and testing risk, so it comes after the lower-risk wins are shipped and demoable. Milestone 4 comes last because it multiplies the *surface area* (more markets to wire, test, and demo) rather than adding new mechanics — better to validate leverage and fixed-rate behavior once, on one market, before multiplying the number of markets they have to work correctly across.

---

## 12. Mainnet migration path

Everything in §4 and §11 targets X Layer testnet. Migration to X Layer mainnet is a **migration, not a rebuild** — same zkEVM architecture, same Solidity — but five components were deliberately mocked for testnet and need real rework, not just a redeploy with new constructor args.

**Carries over unchanged (redeploy only):** `Market.sol`, `LenderVault.sol`, `InterestRateModel.sol`, `HaltController.sol` state machine, `Multisig.sol`/Timelock mechanics, and the Phase 1–3 additions above once built.

**Needs real rework before mainnet:**

| Component | Testnet (current/planned) | Mainnet requirement |
|---|---|---|
| Halt signal | Multisig manually calls `pauseOracle()`/`resumeOracle()` on a mock | Real trust-minimized signal — Backed's own oracle pause (§3.1) or CF Benchmarks' CA feed (§3.1), not self-triggered. This is the product's core IP and needs dedicated design work, not a drop-in swap. |
| Collateral token | `wNVDAx` mock ERC20 with a faucet | Real xStock token from the actual issuer (Backed) — different custody/redemption trust assumptions, no faucet. |
| `SwapModule` (§11) | Internal oracle-priced swap (no testnet DEX liquidity) | Route through a real DEX/aggregator if liquidity exists (§3.2's confirmed ~$588K TVL Uniswap pool) — an internal fixed-price swap holding real money is a manipulation vector. |
| Risk parameters | Demo defaults (LTV, liquidation threshold, rate curve, reserve factor) | Re-derived from real volatility/liquidity data before real TVL sits behind them. |
| Governance signers | Test EOAs | Real multisig signers/threshold. |
| Audit | Foundry tests + Slither self-review | Third-party audit expected before real funds, given lending + liquidation + (post-Phase-3) fixed-term settlement logic. |

Matches the caution already in §6 edge case 8 and §9's success criteria: no claim of mainnet-readiness until every assumption above is independently re-verified against real contracts.
