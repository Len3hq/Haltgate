#!/usr/bin/env python3
"""Pushes real equity prices into HaltGate's mock oracles.

No third-party oracle exists on X Layer testnet: Pyth does not deploy there at
all, and Chainlink's equity coverage is mainnet-only and pull-based. So the
oracle contract stays a mock and this keeper feeds it real quotes. The prices
are real; the oracle is not decentralised, and the docs say so.

Safety properties this script relies on rather than reimplements:
  * setPrice() reverts while the oracle is paused, so a running keeper can
    never overwrite or lift a halt. We skip paused feeds anyway to avoid
    burning gas on transactions that are guaranteed to revert.
  * setPrice() caps a single move at maxNormalUpdateDeviationBps (20%). Rather
    than loosen that guard for the initial re-basing, large moves are stepped:
    each run pushes at most the allowed delta and converges over a few runs.

Usage:
    python3 script/keeper/push_prices.py            # one pass, all markets
    python3 script/keeper/push_prices.py --converge # repeat until aligned
    python3 script/keeper/push_prices.py --dry-run  # fetch and compare only

Env (from .env): FINNHUB_API_KEY, DEPLOYER_PRIVATE_KEY, MULTISIG_ADDRESS,
ORACLE_ADDRESS, TSLA_ORACLE, AAPL_ORACLE, MSFT_ORACLE, SPY_ORACLE, RPC_URL.
"""

import json
import os
import subprocess
import sys
import time
import urllib.request

WAD = 10**18
BPS = 10_000
RPC = os.environ.get("RPC_URL", "https://testrpc.xlayer.tech/terigon")
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# symbol -> the .env key holding that market's oracle address
MARKETS = [
    ("NVDA", "ORACLE_ADDRESS"),
    ("TSLA", "TSLA_ORACLE"),
    ("AAPL", "AAPL_ORACLE"),
    ("MSFT", "MSFT_ORACLE"),
    ("SPY", "SPY_ORACLE"),
]


def load_env():
    env = {}
    path = os.path.join(REPO, ".env")
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def cast_call(target, sig, *args):
    out = subprocess.run(
        ["cast", "call", target, sig, *[str(a) for a in args], "-r", RPC],
        capture_output=True, text=True, timeout=60,
    )
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip()[:200])
    return out.stdout.strip()


def cast_send(target, sig, *args, pk=None):
    """Retries a nonce race; the public RPC lags its own nonce tracking."""
    for _ in range(6):
        out = subprocess.run(
            ["cast", "send", target, sig, *[str(a) for a in args],
             "--private-key", pk, "-r", RPC, "--legacy"],
            capture_output=True, text=True, timeout=180,
        )
        if "status" in out.stdout and "1 (success)" in out.stdout:
            return True
        combined = out.stdout + out.stderr
        if "nonce too low" not in combined:
            raise RuntimeError(combined.strip()[:300])
        time.sleep(2)
    raise RuntimeError("nonce retries exhausted")


def fetch_quote(symbol, api_key):
    """Finnhub's current price. Outside market hours this is the last close,
    which is what we want: pushing it keeps updatedAt fresh without inventing
    movement that did not happen."""
    url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={api_key}"
    req = urllib.request.Request(url, headers={"User-Agent": "haltgate-keeper"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.load(resp)
    price = data.get("c")
    if not price or price <= 0:
        raise RuntimeError(f"no price in response for {symbol}")
    return float(price)


def deviation_bps(old, new):
    diff = abs(new - old)
    return (diff * BPS) // old


def step_toward(current, target, max_bps):
    """Largest move toward target that setPrice() will accept."""
    if deviation_bps(current, target) <= max_bps:
        return target, True
    limit = (current * max_bps) // BPS
    return (current + limit if target > current else current - limit), False


def main():
    dry_run = "--dry-run" in sys.argv
    converge = "--converge" in sys.argv

    env = load_env()
    api_key = env.get("FINNHUB_API_KEY", "").strip()
    if not api_key:
        sys.exit("FINNHUB_API_KEY is not set in .env. Get a free key at finnhub.io.")
    pk = env.get("DEPLOYER_PRIVATE_KEY", "").strip()
    multisig = env.get("MULTISIG_ADDRESS", "").strip()
    if not dry_run and (not pk or not multisig):
        sys.exit("DEPLOYER_PRIVATE_KEY and MULTISIG_ADDRESS must be set in .env.")

    max_rounds = 8 if converge else 1
    for round_no in range(1, max_rounds + 1):
        pending = 0
        print(f"{'symbol':<7}{'on-chain':>11}{'target':>11}{'pushed':>11}  status")

        for symbol, env_key in MARKETS:
            oracle = env.get(env_key, "").strip()
            if not oracle:
                print(f"{symbol:<7}{'':>33}  SKIP: {env_key} not set")
                continue

            try:
                raw = cast_call(oracle, "latestPrice()(uint256,uint256,bool)")
                parts = [p.split()[0] for p in raw.splitlines()]
                current = int(parts[0])
                paused = parts[2].lower() == "true"
            except Exception as exc:
                print(f"{symbol:<7}{'':>33}  READ FAILED: {exc}")
                continue

            # A paused oracle is a halt in progress. setPrice() would revert,
            # and refreshing it would paper over the exact state being shown.
            if paused:
                print(f"{symbol:<7}{current / WAD:>11.2f}{'':>22}  SKIPPED (halted)")
                continue

            try:
                target = int(round(fetch_quote(symbol, api_key) * WAD))
            except Exception as exc:
                print(f"{symbol:<7}{current / WAD:>11.2f}{'':>22}  FETCH FAILED: {exc}")
                continue

            try:
                max_bps = int(cast_call(oracle, "maxNormalUpdateDeviationBps()(uint256)").split()[0])
            except Exception:
                max_bps = 2000

            push, aligned = step_toward(current, target, max_bps)
            if not aligned:
                pending += 1

            note = "aligned" if aligned else f"stepped (cap {max_bps / 100:.0f}%)"
            print(f"{symbol:<7}{current / WAD:>11.2f}{target / WAD:>11.2f}{push / WAD:>11.2f}  "
                  f"{'would push, ' if dry_run else ''}{note}")

            if dry_run or push == current:
                continue

            try:
                data = subprocess.run(
                    ["cast", "calldata", "setPrice(uint256)", str(push)],
                    capture_output=True, text=True, timeout=30,
                ).stdout.strip()
                tx_id = cast_call(multisig, "transactionCount()(uint256)").split()[0]
                cast_send(multisig, "propose(address,uint256,bytes)", oracle, 0, data, pk=pk)
                cast_send(multisig, "execute(uint256)", tx_id, pk=pk)
            except Exception as exc:
                print(f"{'':<7}{'':>33}  PUSH FAILED: {exc}")

        if not converge or pending == 0:
            break
        print(f"\n{pending} market(s) still stepping, round {round_no} of {max_rounds}\n")

    print("\ndone" if not dry_run else "\ndry run, nothing sent")


if __name__ == "__main__":
    main()
