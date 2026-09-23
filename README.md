# HaltGate

A lending market for tokenized US equities (xStocks) on X Layer that knows when **not** to trust its own price feed.

Built for OKX Dev Day 2026 — RWA / Tokenized Stocks track.

**Live app:** [haltgate.len3.xyz](https://haltgate.len3.xyz)

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
- Next.js dashboard organised around three product surfaces rather than one page of tabs: **Markets** (variable borrow, earn, liquidate), **Fixed Term**, and **Multiply**. Each is its own route with its own market table and its own columns
- Borrow, Earn and Liquidate stay tabs on a market page, because they genuinely are three views of one variable-rate position
- A live interest-rate curve, health factor and liquidation-price previews, and a status banner that explains the current halt state in plain language
- A documentation site at `/docs`: 12 pages across getting started, products, mechanics and reference, with a sidebar, anchored headings and prev/next navigation. The contracts page reads the app's own address registry, so it cannot drift from what is deployed
- A self-serve faucet so anyone can get test collateral and try it
- A read-only **Mainnet** view at `/app/mainnet`, toggled from the header. It queries X Layer mainnet live for the eight real tokenized stocks that have on-chain liquidity there: price from their Uniswap pools, pool depth, and Backed's on-chain corporate-action multiplier. Nothing is transactable, because the protocol is not deployed there

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


**Terminal-halt settlement.** A halt froze lender redemptions with no time bound, which meant the mechanism protecting lenders could itself strand their capital indefinitely if the oracle never resumed. Now a clock starts the moment the market leaves `OPEN` (and deliberately does *not* restart across phases — it measures how long capital has been restricted, not how long any one phase lasted). Once it passes `settlementDelay`, **anyone** can call `forceSettle()`. A guarantee that depends on the same governance that let the market get stuck isn't a guarantee.

**Settlement releases capital pro-rata.** Simply re-enabling withdrawals after a timeout would hand back exactly the bank run the freeze prevents — early movers draining cash at a stale share price while latecomers absorb the bad debt. Instead each holder is capped at their proportional slice of available cash. Because everyone redeems at the same price and draws exactly their proportion, cash and supply fall in step and the share price is left arithmetically unchanged: moving first earns no better rate, only earlier access to a slice that was already yours.

**A defaulted fixed-term loan is settled without reading a price.** The plan originally said maturity would seize collateral "at a fixed conversion rate," which quietly reintroduces the oracle dependency the loan type exists to avoid: a frozen or stale price would block settlement exactly when it matters. `settleMatured()` instead claims the **whole** collateral and writes the debt off. Deliberately blunt, and the borrower's protection is the low LTV rather than a partial claim.

This matches [Jupiter Offerbook](https://docs.jup.ag/user-docs/earn/offerbook) on every point that matters, verified against their docs rather than assumed: whole collateral, not automatic, no grace period, and the borrower can still repay right up until the claim lands. One difference is forced by the structure. Offerbook is peer-to-peer so only the named lender may claim; a pool has no such counterparty, which is why `settleMatured()` is permissionless.

The alternative was rejected on purpose. Pooled fixed-rate protocols like [Notional](https://blog.notional.finance/understanding-liquidations/) and Term Finance settle a maturity default by selling *part* of the collateral at a discount to the oracle price and returning the rest. That is fairer to the borrower, and it is precisely what HaltGate cannot do, because it needs a trustworthy price at the moment of settlement and the entire premise here is that windows exist where none is available.

**Fixed-term LTVs are set per asset and all sit below the variable cap.** The main reason is structural rather than about volatility. Offerbook's own documentation works through a **70% LTV** example, roughly double anything offered here, and that is reasonable for them: peer-to-peer means the lender posting a 70% offer is risking their own capital and chose that number. In a shared pool a default is absorbed by every depositor, none of whom picked the LTV, so the cap belongs to governance and has to be conservative. Whole-collateral seizure is only fair when the loan is small relative to what backs it.

The second reason is that nothing can close these positions out early: a liquidatable position gets closed at the first sign of trouble, a fixed-term one has to survive the whole term untouched. Ordering between assets then follows how far each realistically moves over a month: TSLA 30%, NVDA 35%, AAPL and MSFT 40%, SPY 45% (a diversified index, not a single name). All at 8%/yr simple interest.

**Repayment works during a halt; new fixed loans do not.** Same rule the variable path already follows: `repayFixed()` only reduces risk, so it stays open in every state. `settleMatured()` is gated on `canLiquidate()`, which means a halt suspends defaults rather than letting the protocol claim collateral at a price nobody can verify.

The rest, including operator delegation, the settlement bounty, how unearned interest is handled and why the leverage loop stops short rather than reverting, are documented in full at [`/docs`](frontend/app/docs).

## Live deployment

App: [haltgate.len3.xyz](https://haltgate.len3.xyz)

X Layer testnet (chain ID **1952**), explorer: [OKLink](https://www.oklink.com/x-layer-testnet)

Five isolated markets, each with its own collateral token, faucet, oracle, `HaltController`, `LenderVault` and `SwapModule`, so halting one leaves the other four trading.

**Shared**

| Contract | Address |
|---|---|
| USDG (real testnet) | `0xF0863D7A29a55d0c4263c11bFac754312ff078DF` |
| InterestRateModel | `0xC9Dcc5A359F868c4F13BBd658E4e88B1228e1bFD` |
| LeverageZap | `0xfCB4A5C042fE54e04A7F9027992f06F40F4F55be` |
| Multisig | `0x46Af2FD4bF206321Bcd24A58F4497B2681C7716F` |
| Timelock | `0x6e4591c9A44C28f29F570B19ab82781BA136305F` |

**Per market, core contracts**

| Market | Market | LenderVault | HaltController | Oracle |
|---|---|---|---|---|
| NVIDIA | `0x5Ab50694d35Cb078Aa827E819cf3EC8AcCadd022` | `0x7B43744576dBf2C711bE16035FCD812F1A6e4F91` | `0x4C4AC6fd104Eb8CE9887a0e7Da757f86d08EE807` | `0x6092743d17D892c2C6033CF323783Bd7ec5952D4` |
| Tesla | `0x7497EDBb50Fe8F2B71CDC9e98656966eAf6a60BE` | `0xbCf783A460205BE1c1C8dF92C4cC2EBa020C2B9E` | `0x0c69EF3ce2fBaCcadAd1d1dbE88C315dB491d649` | `0xa15Be4B64b08EEfcc85ad375AD391A167DEdF3E2` |
| Apple | `0xA16aCbCe117CF87019c053039c18E9b3b7efDc73` | `0xa16DaB259511dea662Cbf9fc8C68f6A84508F226` | `0x1567e8F41DE5f8a67d3aF33214129AB310149C9A` | `0x365262ae56532C1594B42B6C944768E1aAF9caf6` |
| Microsoft | `0xC9A951d7cC8ae123847288907519ea9FcbCe8492` | `0x51f9c6881bb046F64C4BDe379d071719f1eb42c7` | `0x4FF088755DcB27F88C5515b17F3263CCB3f7E81c` | `0xe722cc0b1C5EadAa69a5deE603954AC71753cc19` |
| S&P 500 ETF | `0x5aeAfD27D4adafd1554d3F78b59AB7a255898c47` | `0xFbCC82c5BC3Cd21170288B37A911D3DF6317B28a` | `0x78aDcB61837Dd42C1AED161F0B3Fd42C57A7ca69` | `0xD1405dba838e4d01Db8581441f47Cd57D49F7f8E` |

**Per market, tokens and periphery**

| Market | Collateral token | Faucet | SwapModule |
|---|---|---|---|
| NVIDIA (wNVDAx) | `0xe37088E75e24AbE5DE1ac6d188803405D9DEbb42` | `0xBCFDa358dfdA7d8FFB53e2294846809c5DB8b57D` | `0x3797E011686e756EFfb8619B5faDCE261BA59680` |
| Tesla (wTSLAx) | `0x3a18BcB208dCF1A5e65d8243E7337F8be3Bb2A13` | `0x2e167DBB68E47c17dc28b7DB6D8A00E896D55692` | `0x10510b248972732b565b333d0Ccfa60493607C21` |
| Apple (wAAPLx) | `0x457e9D75e6ACE368d12442616471EEe28D2Df19c` | `0x3a67fF41E0A14EcCFABff32fD4aEd1aD69a75ad1` | `0xD1ff0651B9e4111cAaA5C33F3150DdE0451B8019` |
| Microsoft (wMSFTx) | `0x4Add596629BddD11C29929A7726873A19A9E95D1` | `0x5bbE7FF75476bc86Db13292cB58d8C61a1524094` | `0xb4681F6945038E5a7Be56C0aFec01ee8A5c2B0c6` |
| S&P 500 ETF (wSPYx) | `0xe28EfB0Eb1A3b17DD59f5E1c3281B0BC147cB313` | `0x2F515a5FF950037857cE9a5C62E677057Ef9fca4` | `0x4c26B0CB20a985049C7a9817aAFd93C6c93cADd2` |

### Current parameters

Shared across all five markets:

| Parameter | Value |
|---|---|
| Liquidation bonus | 5% |
| Reserve factor | 10% |
| Fixed-term rate | 8%/yr, simple |
| Fixed-term length | 1 to 30 days |
| Settlement bounty | 0.5% of seized collateral (capped at 2%) |
| Max oracle staleness | 24 hours |
| Settlement delay | 7 days (bounded 1 to 30) |
| Swap fee | 0.30% (capped at 5%) |
| Max leverage | Contract cap 5x; the reachable ceiling is `1 / (1 - maxLTV)` per market, so 1.82x to 2.50x |

Risk parameters are set per asset, ordered by how far each one realistically moves. Both loan types are tiered now, and the fixed-term cap always sits below the variable one because nothing can close those positions out early:

| Market | Variable max LTV | Liquidation threshold | Fixed-term max LTV | Leverage ceiling |
|---|---|---|---|---|
| Tesla | 45% | 50% | 30% | 1.82x |
| NVIDIA | 50% | 55% | 35% | 2.00x |
| Apple | 55% | 60% | 40% | 2.22x |
| Microsoft | 55% | 60% | 40% | 2.22x |
| S&P 500 ETF | 60% | 65% | 45% | 2.50x |

## Running it

Contracts ([Foundry](https://book.getfoundry.sh/)):

```bash
forge build
forge test          # 320 tests across 25 suites, including fuzz properties
```

Frontend:

```bash
cd frontend
npm install
npm run dev         # http://localhost:3000
```

To use the live testnet app you'll need testnet OKB for gas ([X Layer faucet](https://web3.okx.com/xlayer/faucet)), testnet USDG ([Paxos faucet](https://faucet.paxos.com)), and wNVDAx from the in-app faucet (one claim per address).

Redeploying? Update [`frontend/lib/contracts.ts`](frontend/lib/contracts.ts) and nothing else needs to change — every component reads addresses from there.

### Keeping the oracles fed

```bash
python3 script/keeper/push_prices.py --dry-run   # fetch and compare, send nothing
python3 script/keeper/push_prices.py             # one pass over all five markets
python3 script/keeper/push_prices.py --converge  # repeat until every market is aligned
```

Needs a free `FINNHUB_API_KEY` in `.env`. Run it on a schedule, every 15 minutes is a good default:

```
*/15 * * * * cd /path/to/Haltgate && /usr/bin/python3 script/keeper/push_prices.py >> /tmp/haltgate-keeper.log 2>&1
```

Without it the mocks age past the 24-hour staleness window and borrowing stops across every market.

## What's mocked, and why

This project has been deliberate about not overstating what's real:

- **wNVDAx is a mock.** No xStock — raw or wrapped — is confirmed to exist on X Layer *testnet*. The mock replicates the confirmed wrapped-xStock design: non-rebasing, with value accruing through an exchange rate. Real wNVDAx liquidity does exist on X Layer **mainnet**.
- **The oracle contract is a mock, but the prices in it are real.** `script/keeper/push_prices.py` fetches live equity quotes and pushes them in, so the displayed price tracks the reference chart. It is a single-key push feed, not a decentralised oracle: the data is real, the trust model is not. Nothing better was available, since **Pyth does not deploy on X Layer at all** (confirmed against their contract registry: 65 mainnets, 89 testnets, no X Layer entry) and **Chainlink's equity coverage there is mainnet-only and pull-based**, so no contract holds a readable current price.
- **The keeper cannot interfere with a halt.** `setPrice()` reverts while the oracle is paused, so price pushes can never overwrite or lift one, and the keeper skips paused feeds outright. A halted market stays visibly frozen while the reference chart keeps moving, which is the thesis made visible.
- **Large price moves are stepped, not forced.** A single update is capped at 20% deviation. Rather than loosen that guard for the initial re-basing, the keeper pushes the largest allowed step and converges over successive runs. Verified: NVDA converged exactly in 2 rounds, AAPL in 3, a simulated 60% crash in 5. Whether a live Chainlink feed for wNVDAx is queryable on X Layer specifically was never confirmed, so the pause mechanism is reproduced faithfully rather than assumed.
- **USDG is real** testnet USDG (6 decimals, not 18 — confirmed against the deployed contract).
- **Governance is configured for testnet convenience**: the multisig is 1-of-1 and the timelock delay is 10 minutes. Neither is a meaningful security boundary as deployed; both are real contracts wired correctly, just parameterized for a demo.
- **Leverage here is directional.** Unlike correlated-asset looping (staking token against its underlying), collateral and debt here move independently, so leverage genuinely amplifies risk in both directions.
- **Not audited.** Foundry tests and Slither are engineering hygiene, not a substitute for third-party review.

## Roadmap

Detailed plan and status in [`BUILD.md`](BUILD.md).

- **Converting seized collateral back to cash.** `settleMatured()` leaves the protocol holding collateral while the vault is owed USDG, and the share price stays understated until governance sells it. `withdrawSeizedCollateral()` hands it over for that; routing it through the `SwapModule` automatically is the obvious next step, and was left out on purpose because an automatic sale reads a price, which is the dependency this loan type exists to avoid.
- **CF Benchmarks corporate-action feed** — a real third-party CA feed exists with a documented methodology, a genuine upgrade path beyond a manually-toggled schedule

## Prior art and attribution

**[Corporate Action Guard](https://github.com/gnanam1990/corporate-action-guard)** is a real, third-party, unaudited project live on X Layer testnet doing an adjacent thing: fail-closed preflight and receipt checking around corporate-action windows. HaltGate follows its **gating pattern** rather than rebuilding the idea from scratch, and it is named here as a reference implementation rather than quietly borrowed from.

The mechanisms differ. Its gate is keyed to a receipt and schedule model; HaltGate's is keyed to the oracle's own pause flag. Its scope is the gate alone, with no borrowing, leverage, liquidation or vault logic. Treat it as prior art for the general "fail closed during a corporate action" idea, not as a dependency or a competitor.

**[CF Benchmarks](https://www.cfbenchmarks.com/documentation/products/xstocks/corporate-actions-feed)** publishes the xStocks Corporate Action Feed, whose Pending and Effective lifecycle maps onto HALTING and RESUMING. It is the route to automating detection, and it is not integrated here.

**[Jupiter Offerbook](https://docs.jup.ag/user-docs/earn/offerbook)** is the reference for fixed-term settlement behaviour, checked directly against their documentation rather than assumed. **Kamino** is the reference for the interface, and **Notional** and **Term Finance** are the pooled fixed-rate alternative that was considered and rejected.

## Mainnet migration

Migration, not a rebuild. X Layer mainnet is the same zkEVM environment and the core contracts port over unchanged. Two things do change, both verified against chain 196 rather than assumed:

**Price.** There is no contract exposing `latestPrice()` there, but the real Uniswap pools do quote the wrapped xStocks, and their prices land within 0.3% of live market quotes. Chainlink covers equities on X Layer as pull-based Data Streams, which would move verification cost into each caller's transaction.

**Halt detection.** No production feed exposes a pause flag. Every raw xStock does expose `multiplier()`, which Backed updates when a corporate action takes effect, so a change in that value replaces the oracle pause as the trigger. `HALTED` and `RESUMING` port across; `HALTING` does not, because advance warning needs an external input such as the CF Benchmarks Pending stage.

Everything else, the state machine, gating, settlement and the leverage stack, is unaffected. What remains is an audit, lending liquidity, and DEX routing to replace the internal `SwapModule`.
