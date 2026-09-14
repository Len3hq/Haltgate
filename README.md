# HaltGate

An X Layer credit desk for xStocks (tokenized US equities/ETFs) that freezes lending, leverage, and liquidation across official corporate-action windows, so dividend/split rebases can't corrupt balances, LPs, or liquidations.

Built for OKX Dev Day 2026 — RWA/Tokenized Stocks track.

## The problem

xStocks on X Layer has real inventory ($91.5M market cap, 836 assets) and no on-chain financing — Aave on X Layer doesn't list them as collateral, and the protocols that do this elsewhere (Kamino, Jupiter Lend, Morpho) aren't on X Layer. On top of that, xStocks tokens rebase their actual on-chain balance during corporate actions on EVM chains (confirmed — unlike Solana, where the multiplier is display-layer only), so a lending or liquidation engine left running through that window can misprice collateral or create bad debt.

## What this repo builds (v1 / hackathon scope)

- A halt-gating primitive tracking OPEN → HALTING → HALTED → RESUMING for a market, wired into or forked from the pattern established by [Corporate Action Guard](https://github.com/gnanam1990/corporate-action-guard) (a related, unaudited X Layer testnet project doing the same gating job in isolation).
- A single-market borrow/repay flow: deposit collateral, borrow USDG, repay — gated by the halt state machine.
- A manually-toggled mock corporate-action schedule for demo purposes.

**Not in v1:** leveraged looping (Multiply), LP-token collateral, multi-asset baskets, per-tier risk parameters, or an agent/AI policy layer. These are roadmap, not build — see the team's full spec for the long-term product vision.

## Status

Early build. Full technical spec, verified facts, and edge-case handling are maintained by the team outside this repo.
