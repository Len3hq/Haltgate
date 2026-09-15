# HaltGate

An X Layer credit desk for xStocks (tokenized US equities/ETFs) that freezes lending, leverage, and liquidation across official corporate-action windows, so dividend/split rebases can't corrupt balances, LPs, or liquidations.

Built for OKX Dev Day 2026 — RWA/Tokenized Stocks track.

## The problem

xStocks on X Layer has real inventory and no on-chain financing — Aave on X Layer doesn't list them as collateral (confirmed: only USDT0/USDG/GHO/xBTC/xETH/xSOL/xBETH/xOKSOL), and the protocols that do this elsewhere (Kamino, Jupiter Lend, Morpho) aren't on X Layer. On top of that, xStocks' issuer (Backed) pauses its own price oracle during corporate actions — a mechanism that applies to both raw (rebasing) and wrapped (non-rebasing) xStocks — so a lending or liquidation engine reading a stale/frozen price through that window can misprice collateral or create bad debt.

## What this repo builds (v1 / hackathon scope)

- A halt-gating primitive tracking OPEN → HALTING → HALTED → RESUMING for a market, triggered by oracle-pause state (mirroring Backed's own confirmed `pauseOracle()` behavior).
- A single-market borrow/repay flow: deposit wNVDAx (confirmed liquid on X Layer), borrow USDG, repay — gated by the halt state machine.
- A corporate-action timing schedule (real, confirmed activation timing) driving the halt window, with a live oracle feed where reachable.

**Not in v1:** leveraged looping (Multiply), LP-token collateral, multi-asset baskets, per-tier risk parameters, or an agent/AI policy layer. These are roadmap, not build.

## Toolchain

[Foundry](https://book.getfoundry.sh/) — `forge build`, `forge test`.

## Status

Early build. Full technical spec, verified facts, and edge-case handling: see [`BUILD.md`](./BUILD.md).
