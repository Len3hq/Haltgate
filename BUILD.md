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
