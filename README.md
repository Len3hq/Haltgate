# HaltGate

A lending market for tokenized US equities (xStocks) on X Layer that knows when **not** to trust its own price feed.

Built for OKX Dev Day 2026 — RWA / Tokenized Stocks track.

---

## The problem

Tokenized stocks are not like other collateral. Real equities have corporate actions — splits, dividends, reverse splits — and during those windows the price of the underlying is genuinely unknown, not merely volatile.

xStocks' issuer (Backed) handles this by **pausing its own price oracle**: the feed freezes at its last known-good value until the corporate action settles. That's a confirmed, documented behavior, and it applies to both raw (rebasing) and wrapped (non-rebasing) xStocks, since the pause happens at the oracle layer.

A conventional lending market reading through that pause will happily keep operating on a stale price — mispricing collateral, letting people borrow against a number that no longer means anything, and liquidating positions on a feed that is, by the issuer's own admission, not currently valid.

Meanwhile, X Layer has real xStock liquidity (a USDG/wNVDAx pool with meaningful TVL) and no on-chain financing for it. Aave on X Layer lists no tokenized equity of any kind. The protocols that do xStock-collateral lending — Kamino, Jupiter Lend, Morpho — aren't on X Layer.

So: the asset exists here, the trading venue exists here, the lending venue doesn't.

## What makes this different

HaltGate treats "is this price trustworthy right now?" as a **first-class protocol state**, not an edge case. A `HaltController` tracks the market through five states, and every risk-increasing action is gated on it.

| State | What it means | Allowed | Blocked |
|---|---|---|---|
| `OPEN` | Normal operation | Everything | — |
| `HALTING` | A corporate action is expected shortly | Repay, withdraw (debt-free) | New supply, borrow, liquidation |
| `HALTED` | Oracle is paused; price is frozen | Repay only | Supply, borrow, liquidation. **Interest stops accruing.** |
| `RESUMING` | Oracle is live again, verifying before reopening | Repay | Liquidation stays off — a just-resumed price is exactly when liquidating is most dangerous |
| `SETTLING` | The halt ran past its maximum duration | Repay; **lenders withdraw pro-rata** | Supply, borrow, liquidation. Interest still frozen. |

The trigger is the oracle's own paused flag, read permissionlessly via `sync()` — anyone can call it, so the market can never silently drift out of sync with reality.

Three details that matter more than they look:

- **Interest freezes during a halt.** Charging interest while liquidation is disabled and the price is frozen would push borrowers toward a liquidation they have no way to defend against.
- **Liquidations stay off through `RESUMING`, not just `HALTED`.** The moment right after a price un-freezes is the most dangerous time to be liquidating anyone.
- **A halt cannot last forever.** Past a maximum duration, anyone can force the market into `SETTLING` — see [Key design decisions](#key-design-decisions).

## What's built

**Lending**
- Supply wNVDAx as collateral, borrow USDG against it, repay, withdraw — all halt-gated
- Compound-v2-style borrow index with lazy interest accrual
- Kinked two-slope interest rate model (10%/yr slope below an 80% utilization kink, 300%/yr above)
- Liquidations with a close factor and a liquidation bonus, blocked whenever the price isn't trustworthy

**Lending side (Earn)**
- ERC-4626 vault (`hgUSDG`): deposit USDG, earn what borrowers pay
- Yield is expressed purely as share price — there is no separately-tracked supply rate that could drift out of sync with it
- Redemptions are halt-gated (see design decisions), and pro-rata during settlement

**Leverage**
- `leverage()` — one transaction: supply, borrow, swap into more collateral, supply that too
- `multiply()` — pick a target multiple and the loop runs itself until it gets there
- Both halt-gated: you cannot lever up into a stock whose price is currently frozen

**Governance**
- Three tiers: a permissionless keeper path for fast state transitions, a multisig for the oracle, and multisig-behind-timelock for risk parameters and contract ownership

**Frontend**
- Next.js dashboard with persona tabs (Borrow / Leverage / Earn / Liquidate), a live interest-rate curve, health factor and liquidation-price previews, and a status banner that explains the current halt state in plain language
- A self-serve faucet so anyone can get test collateral and try it

## Architecture

| Contract | Role |
|---|---|
| [`HaltController`](src/core/HaltController.sol) | The five-state machine. Reads the oracle's pause flag; gates everything else. |
| [`Market`](src/core/Market.sol) | Collateral, debt, LTV, liquidations, interest accrual. Never custodies lender cash. |
| [`LenderVault`](src/core/LenderVault.sol) | ERC-4626 vault holding the actual USDG. Halt-gated and settlement-aware redemptions. |
| [`InterestRateModel`](src/core/InterestRateModel.sol) | Kinked utilization curve, per-second rates in WAD. |
| [`SwapModule`](src/periphery/SwapModule.sol) | Oracle-priced wNVDAx↔USDG swap standing in for a DEX. Halt-gated. |
| [`LeverageZap`](src/periphery/LeverageZap.sol) | Stateless one-click leverage and multiply. Takes the market as a parameter. |
| [`Multisig`](src/governance/Multisig.sol) | Propose / confirm / execute, threshold-based. |
| [`WNVDAxFaucet`](src/tokens/WNVDAxFaucet.sol) | Permissionless, one claim per address. |

## Key design decisions

**Positions are credited to users, not to the zap.** `Market.supply()`/`borrow()` are hardcoded to `msg.sender`, so a periphery contract calling them would have ended up owning the user's leveraged position. Rather than hack around it, `Market` gained an operator-delegation layer — `setOperator()` plus `supplyFor()`/`borrowFor()` — modelled on ERC-20 approve: explicit, revocable, and grantable only by the position owner over themselves. The plain `supply()`/`borrow()` share the same internals, so the two paths can't drift apart.

**Terminal-halt settlement.** A halt froze lender redemptions with no time bound, which meant the mechanism protecting lenders could itself strand their capital indefinitely if the oracle never resumed. Now a clock starts the moment the market leaves `OPEN` (and deliberately does *not* restart across phases — it measures how long capital has been restricted, not how long any one phase lasted). Once it passes `settlementDelay`, **anyone** can call `forceSettle()`. A guarantee that depends on the same governance that let the market get stuck isn't a guarantee.

**Settlement releases capital pro-rata.** Simply re-enabling withdrawals after a timeout would hand back exactly the bank run the freeze prevents — early movers draining cash at a stale share price while latecomers absorb the bad debt. Instead each holder is capped at their proportional slice of available cash. Because everyone redeems at the same price and draws exactly their proportion, cash and supply fall in step and the share price is left arithmetically unchanged: moving first earns no better rate, only earlier access to a slice that was already yours.

**Governance can retune the settlement delay but never revoke it.** `settlementDelay` is bounded between 1 and 30 days. The floor stops governance setting it near zero and letting anyone stall an ordinary halt; the ceiling stops governance quietly restoring the indefinite lockup.

**Leverage looping stops early rather than reverting.** A market's max LTV caps achievable leverage at `1 / (1 - maxLTV)` — 2x here — which is an asymptote no finite number of loops reaches. Reverting on a near-miss would reject reasonable requests, so each pass is capped by live LTV headroom and available liquidity, and a caller-supplied `minFinalCollateral` floor is what actually protects against under-delivery.

**Precision fidelity over precision.** `LeverageZap` computes borrow headroom using the same two-step rounding as `Market`, even though collapsing it would be more precise — because rounding even one wei above Market's own figure makes the next borrow revert and kills the loop. Matching the reference implementation beats being marginally more accurate than it.

## Live deployment

X Layer testnet (chain ID **1952**), explorer: [OKLink](https://www.oklink.com/x-layer-testnet)

| Contract | Address |
|---|---|
| HaltController | `0x4C4AC6fd104Eb8CE9887a0e7Da757f86d08EE807` |
| Market | `0x3ff6a0071655B1179C64f7114b175B141af91978` |
| LenderVault | `0x0051f29d5E2BFC85542266a3B9894Da2db2aDf4d` |
| InterestRateModel | `0x5F644BDF606cdb770c76bb01d6c3B83EA9F21845` |
| SwapModule | `0x3797E011686e756EFfb8619B5faDCE261BA59680` |
| LeverageZap | `0xfCB4A5C042fE54e04A7F9027992f06F40F4F55be` |
| Oracle (mock) | `0x6092743d17D892c2C6033CF323783Bd7ec5952D4` |
| wNVDAx (mock) | `0xe37088E75e24AbE5DE1ac6d188803405D9DEbb42` |
| wNVDAx faucet | `0xBCFDa358dfdA7d8FFB53e2294846809c5DB8b57D` |
| USDG (real testnet) | `0xF0863D7A29a55d0c4263c11bFac754312ff078DF` |
| Multisig | `0x46Af2FD4bF206321Bcd24A58F4497B2681C7716F` |
| Timelock | `0x6e4591c9A44C28f29F570B19ab82781BA136305F` |

### Current parameters

| Parameter | Value |
|---|---|
| Max LTV | 50% |
| Liquidation threshold | 55% |
| Liquidation bonus | 5% |
| Reserve factor | 10% |
| Max oracle staleness | 24 hours |
| Settlement delay | 7 days (bounded 1–30) |
| Swap fee | 0.30% (capped at 5%) |
| Max leverage | Contract cap 5x; ~2x actually reachable at a 50% LTV |

## Running it

Contracts ([Foundry](https://book.getfoundry.sh/)):

```bash
forge build
forge test          # 261 tests across 22 suites
```

Frontend:

```bash
cd frontend
npm install
npm run dev         # http://localhost:3000
```

To use the live testnet app you'll need testnet OKB for gas ([X Layer faucet](https://web3.okx.com/xlayer/faucet)), testnet USDG ([Paxos faucet](https://faucet.paxos.com)), and wNVDAx from the in-app faucet (one claim per address).

Redeploying? Update [`frontend/lib/contracts.ts`](frontend/lib/contracts.ts) and nothing else needs to change — every component reads addresses from there.

## What's mocked, and why

This project has been deliberate about not overstating what's real:

- **wNVDAx is a mock.** No xStock — raw or wrapped — is confirmed to exist on X Layer *testnet*. The mock replicates the confirmed wrapped-xStock design: non-rebasing, with value accruing through an exchange rate. Real wNVDAx liquidity does exist on X Layer **mainnet**.
- **The oracle is a mock** replicating Backed's confirmed `pauseOracle()` behavior. Whether a live Chainlink feed for wNVDAx is queryable on X Layer specifically was never confirmed, so the pause mechanism is reproduced faithfully rather than assumed.
- **USDG is real** testnet USDG (6 decimals, not 18 — confirmed against the deployed contract).
- **Governance is configured for testnet convenience**: the multisig is 1-of-1 and the timelock delay is 10 minutes. Neither is a meaningful security boundary as deployed; both are real contracts wired correctly, just parameterized for a demo.
- **Leverage here is directional.** Unlike correlated-asset looping (staking token against its underlying), collateral and debt here move independently, so leverage genuinely amplifies risk in both directions.
- **Not audited.** Foundry tests and Slither are engineering hygiene, not a substitute for third-party review.

## Roadmap

Detailed plan and status in [`BUILD.md`](BUILD.md).

- **Fixed-rate borrowing without liquidation** — a second loan type where maturity replaces price-triggered liquidation, inspired by Jupiter Offerbook's model but living inside the existing pooled market rather than fragmenting it into P2P escrows
- **Multi-market** — a second and third xStock, which is also the only way to *demonstrate* that halts are per-asset: halting NVDA while TSLA keeps trading normally
- **CF Benchmarks corporate-action feed** — a real third-party CA feed exists with a documented methodology, a genuine upgrade path beyond a manually-toggled schedule

## Mainnet migration

Migration, not a rebuild — X Layer mainnet is the same zkEVM environment, and the core contracts port over unchanged. What genuinely needs rework is everything that touches the outside world: a real trust-minimized halt signal instead of a self-controlled oracle, the real xStock token, DEX routing instead of an internal priced swap, risk parameters derived from real volatility data, real multisig signers, and an audit. Detail in [`BUILD.md` §12](BUILD.md).
