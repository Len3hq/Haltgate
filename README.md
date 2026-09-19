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

**Fixed-term borrowing (no liquidation)**
- Lock a rate and an end date: `borrowFixed()` quotes the total owed up front and it never changes
- The position cannot be liquidated on price at any point during the term, however far the stock falls
- Maturity replaces liquidation: repay in full and unlock the collateral, or anyone can call `settleMatured()` and the collateral passes to the protocol, minus a small bounty to whoever settled
- Per-asset LTV caps, all set below the variable market's, because nothing closes these positions out early

**Governance**
- Three tiers: a permissionless keeper path for fast state transitions, a multisig for the oracle, and multisig-behind-timelock for risk parameters and contract ownership

**Frontend**
- Next.js dashboard with persona tabs (Borrow / Fixed / Leverage / Earn / Liquidate), a live interest-rate curve, health factor and liquidation-price previews, and a status banner that explains the current halt state in plain language
- A self-serve faucet so anyone can get test collateral and try it

## Architecture

| Contract | Role |
|---|---|
| [`HaltController`](src/core/HaltController.sol) | The five-state machine. Reads the oracle's pause flag; gates everything else. |
| [`Market`](src/core/Market.sol) | Collateral, debt, LTV, liquidations, interest accrual, and fixed-term loans. Never custodies lender cash. |
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

**A defaulted fixed-term loan is settled without reading a price.** The plan originally said maturity would seize collateral "at a fixed conversion rate," which quietly reintroduces the oracle dependency the loan type exists to avoid: a frozen or stale price would block settlement exactly when it matters. `settleMatured()` instead claims the **whole** collateral and writes the debt off. Deliberately blunt, and the borrower's protection is the low LTV rather than a partial claim.

This matches [Jupiter Offerbook](https://docs.jup.ag/user-docs/earn/offerbook) on every point that matters, verified against their docs rather than assumed: whole collateral, not automatic, no grace period, and the borrower can still repay right up until the claim lands. One difference is forced by the structure. Offerbook is peer-to-peer so only the named lender may claim; a pool has no such counterparty, which is why `settleMatured()` is permissionless.

The alternative was rejected on purpose. Pooled fixed-rate protocols like [Notional](https://blog.notional.finance/understanding-liquidations/) and Term Finance settle a maturity default by selling *part* of the collateral at a discount to the oracle price and returning the rest. That is fairer to the borrower, and it is precisely what HaltGate cannot do, because it needs a trustworthy price at the moment of settlement and the entire premise here is that windows exist where none is available.

**Fixed-term LTVs are set per asset and all sit below the variable cap.** The main reason is structural rather than about volatility. Offerbook's own documentation works through a **70% LTV** example, roughly double anything offered here, and that is reasonable for them: peer-to-peer means the lender posting a 70% offer is risking their own capital and chose that number. In a shared pool a default is absorbed by every depositor, none of whom picked the LTV, so the cap belongs to governance and has to be conservative. Whole-collateral seizure is only fair when the loan is small relative to what backs it.

The second reason is that nothing can close these positions out early: a liquidatable position gets closed at the first sign of trouble, a fixed-term one has to survive the whole term untouched. Ordering between assets then follows how far each realistically moves over a month: TSLA 30%, NVDA 35%, AAPL and MSFT 40%, SPY 45% (a diversified index, not a single name). All at 8%/yr simple interest.

**Settling a matured loan pays a bounty, because permission without incentive is not a mechanism.** `settleMatured()` is permissionless, but the collateral goes to the protocol, so the caller originally received nothing for their gas. Offerbook gets this alignment for free: the lender claims, and the lender keeps the collateral. A pool has no such counterparty, so the permission carried over but the incentive did not, and a defaulted loan could sit unsettled indefinitely while the vault kept counting it at full face value. The settler now takes 0.5% of the seized collateral, capped on-chain at 2%. It is denominated in collateral tokens rather than dollars, so paying it reads no price. The cap sits far below the 5% liquidation bonus on purpose: a liquidator fronts the debt, a settler fronts only gas.

**A known gap, stated rather than papered over.** `totalAssets()` counts fixed principal but not seized collateral, so the share price dips between settlement and governance selling that collateral, then recovers above where it started (at a 30 to 45% LTV the collateral is worth two to three times the debt). Closing the gap properly means valuing the collateral, which is the exact oracle dependency this loan type exists to avoid. The bounty makes settlement prompt, which shrinks the window; it does not eliminate it.

**Fixed-term interest is recognised at repayment, not accrued in advance.** Booking unearned interest into the share price would let a lender deposit late, redeem early, and collect yield on a loan that had not paid yet. `LenderVault.totalAssets()` counts outstanding fixed **principal** only; the interest lifts the share price at the moment it actually arrives.

**Repayment works during a halt; new fixed loans do not.** Same rule the variable path already follows: `repayFixed()` only reduces risk, so it stays open in every state. `settleMatured()` is gated on `canLiquidate()`, which means a halt suspends defaults rather than letting the protocol claim collateral at a price nobody can verify.

**Leverage looping stops early rather than reverting.** A market's max LTV caps achievable leverage at `1 / (1 - maxLTV)` — 2x here — which is an asymptote no finite number of loops reaches. Reverting on a near-miss would reject reasonable requests, so each pass is capped by live LTV headroom and available liquidity, and a caller-supplied `minFinalCollateral` floor is what actually protects against under-delivery.

**Precision fidelity over precision.** `LeverageZap` computes borrow headroom using the same two-step rounding as `Market`, even though collapsing it would be more precise — because rounding even one wei above Market's own figure makes the next borrow revert and kills the loop. Matching the reference implementation beats being marginally more accurate than it.

## Live deployment

X Layer testnet (chain ID **1952**), explorer: [OKLink](https://www.oklink.com/x-layer-testnet)

Five isolated markets are live. Each has its own collateral token, faucet, oracle, `HaltController`, `LenderVault`, `Market` and `SwapModule`, so halting one leaves the other four trading.

**Shared across all markets**

| Contract | Address |
|---|---|
| USDG (real testnet) | `0xF0863D7A29a55d0c4263c11bFac754312ff078DF` |
| InterestRateModel | `0x5F644BDF606cdb770c76bb01d6c3B83EA9F21845` |
| LeverageZap | `0xfCB4A5C042fE54e04A7F9027992f06F40F4F55be` |
| Multisig | `0x46Af2FD4bF206321Bcd24A58F4497B2681C7716F` |
| Timelock | `0x6e4591c9A44C28f29F570B19ab82781BA136305F` |

**NVIDIA (wNVDAx)**

| Contract | Address |
|---|---|
| Market | `0xfbc2FA97cF8c4C5D27D3C3D1Fc65b75A6Cc87d7E` |
| LenderVault | `0xdcbD086f600Cdb73C311A89aF4C73919aA6946d2` |
| HaltController | `0x4C4AC6fd104Eb8CE9887a0e7Da757f86d08EE807` |
| Oracle (mock) | `0x6092743d17D892c2C6033CF323783Bd7ec5952D4` |
| SwapModule | `0x3797E011686e756EFfb8619B5faDCE261BA59680` |
| Collateral token | `0xe37088E75e24AbE5DE1ac6d188803405D9DEbb42` |
| Faucet | `0xBCFDa358dfdA7d8FFB53e2294846809c5DB8b57D` |

**Tesla (wTSLAx)**

| Contract | Address |
|---|---|
| Market | `0x73a0E12bD641113E9a9Cb74f6b1d54029943aB90` |
| LenderVault | `0x5f245b620A2B104570e3902AeDb12205C37a8E73` |
| HaltController | `0x0c69EF3ce2fBaCcadAd1d1dbE88C315dB491d649` |
| Oracle (mock) | `0xa15Be4B64b08EEfcc85ad375AD391A167DEdF3E2` |
| SwapModule | `0x10510b248972732b565b333d0Ccfa60493607C21` |
| Collateral token | `0x3a18BcB208dCF1A5e65d8243E7337F8be3Bb2A13` |
| Faucet | `0x2e167DBB68E47c17dc28b7DB6D8A00E896D55692` |

**Apple (wAAPLx)**

| Contract | Address |
|---|---|
| Market | `0xb19b7A46683C4862333fa5a860C1f4a2FF7f6Bbe` |
| LenderVault | `0x4248d1948CE12BF501036e86C3577469849fA8e9` |
| HaltController | `0x1567e8F41DE5f8a67d3aF33214129AB310149C9A` |
| Oracle (mock) | `0x365262ae56532C1594B42B6C944768E1aAF9caf6` |
| SwapModule | `0xD1ff0651B9e4111cAaA5C33F3150DdE0451B8019` |
| Collateral token | `0x457e9D75e6ACE368d12442616471EEe28D2Df19c` |
| Faucet | `0x3a67fF41E0A14EcCFABff32fD4aEd1aD69a75ad1` |

**Microsoft (wMSFTx)**

| Contract | Address |
|---|---|
| Market | `0xCf17F4457ae8b2A6720Ae8499B807D0221f90720` |
| LenderVault | `0xdc6d47274397Da642a1a4abdb75273f48F6aF9bF` |
| HaltController | `0x4FF088755DcB27F88C5515b17F3263CCB3f7E81c` |
| Oracle (mock) | `0xe722cc0b1C5EadAa69a5deE603954AC71753cc19` |
| SwapModule | `0xb4681F6945038E5a7Be56C0aFec01ee8A5c2B0c6` |
| Collateral token | `0x4Add596629BddD11C29929A7726873A19A9E95D1` |
| Faucet | `0x5bbE7FF75476bc86Db13292cB58d8C61a1524094` |

**S&P 500 ETF (wSPYx)**

| Contract | Address |
|---|---|
| Market | `0xDE3FfdE11a8C56B28d52148c0038F3a834F2d481` |
| LenderVault | `0x4Fd339772Bd35113BEb674c3ABa4B897cedA4595` |
| HaltController | `0x78aDcB61837Dd42C1AED161F0B3Fd42C57A7ca69` |
| Oracle (mock) | `0xD1405dba838e4d01Db8581441f47Cd57D49F7f8E` |
| SwapModule | `0x4c26B0CB20a985049C7a9817aAFd93C6c93cADd2` |
| Collateral token | `0xe28EfB0Eb1A3b17DD59f5E1c3281B0BC147cB313` |
| Faucet | `0x2F515a5FF950037857cE9a5C62E677057Ef9fca4` |

### Current parameters

Shared across all five markets:

| Parameter | Value |
|---|---|
| Max LTV (variable) | 50% |
| Liquidation threshold | 55% |
| Liquidation bonus | 5% |
| Reserve factor | 10% |
| Fixed-term rate | 8%/yr, simple |
| Fixed-term length | 1 to 30 days |
| Settlement bounty | 0.5% of seized collateral (capped at 2%) |
| Max oracle staleness | 24 hours |
| Settlement delay | 7 days (bounded 1 to 30) |
| Swap fee | 0.30% (capped at 5%) |
| Max leverage | Contract cap 5x; ~2x actually reachable at a 50% LTV |

Fixed-term LTV is set per asset, ordered by how far each realistically moves over a month:

| Market | Fixed-term max LTV |
|---|---|
| Tesla | 30% |
| NVIDIA | 35% |
| Apple | 40% |
| Microsoft | 40% |
| S&P 500 ETF | 45% |

## Running it

Contracts ([Foundry](https://book.getfoundry.sh/)):

```bash
forge build
forge test          # 292 tests across 23 suites
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
- **The oracle is a mock** replicating Backed's confirmed `pauseOracle()` behavior. It needs a price pushed at least once every 24 hours or borrowing stops protocol-wide on the staleness check, which is correct behaviour but does mean the testnet demo needs a keeper nudge if it sits idle for a day. Whether a live Chainlink feed for wNVDAx is queryable on X Layer specifically was never confirmed, so the pause mechanism is reproduced faithfully rather than assumed.
- **USDG is real** testnet USDG (6 decimals, not 18 — confirmed against the deployed contract).
- **Governance is configured for testnet convenience**: the multisig is 1-of-1 and the timelock delay is 10 minutes. Neither is a meaningful security boundary as deployed; both are real contracts wired correctly, just parameterized for a demo.
- **Leverage here is directional.** Unlike correlated-asset looping (staking token against its underlying), collateral and debt here move independently, so leverage genuinely amplifies risk in both directions.
- **Not audited.** Foundry tests and Slither are engineering hygiene, not a substitute for third-party review.

## Roadmap

Detailed plan and status in [`BUILD.md`](BUILD.md).

- **Converting seized collateral back to cash.** `settleMatured()` leaves the protocol holding collateral while the vault is owed USDG, and the share price stays understated until governance sells it. `withdrawSeizedCollateral()` hands it over for that; routing it through the `SwapModule` automatically is the obvious next step, and was left out on purpose because an automatic sale reads a price, which is the dependency this loan type exists to avoid.
- **Per-asset variable LTVs.** The fixed-term caps are tiered per asset; the variable-rate cap is still a flat 50% everywhere, which means Tesla at 50% carries more risk than the S&P at 50%. Same reasoning, same numbers, not yet applied.
- **CF Benchmarks corporate-action feed** — a real third-party CA feed exists with a documented methodology, a genuine upgrade path beyond a manually-toggled schedule

## Mainnet migration

Migration, not a rebuild — X Layer mainnet is the same zkEVM environment, and the core contracts port over unchanged. What needs real work is everything touching the outside world: the real xStock token, DEX routing instead of an internal priced swap, risk parameters derived from real volatility data, real multisig signers, and an audit.

The oracle is the biggest piece, and larger than "swap an address." Real NVDA pricing **does** exist on X Layer mainnet — OKX adopted Chainlink there in June 2026, covering 24/5 equities including NVDA. But it ships as **Data Streams**, which is pull-based: there's no contract holding a current price to read, so every price-dependent path needs a caller-supplied signed report verified on-chain. Separately, no feed exposes a pause flag — a corporate-action pause is detected by the feed going stale, and staleness alone can't distinguish a corporate action from a weekend. Closing that gap needs a corporate-action feed or a market-hours calendar.

The halt state machine, gating, settlement and leverage stack are unaffected by any of it. Detail in [`BUILD.md` §3.4 and §12](BUILD.md).
