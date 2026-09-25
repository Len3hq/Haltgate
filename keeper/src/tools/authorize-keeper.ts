import { encodeFunctionData, formatEther, isAddress, keccak256, parseEther, toHex, type Hex } from "viem";
import { SHARED } from "../../../frontend/lib/contracts";
import { Signer } from "../keeper/signer";
import { addSignerAbi, haltControllerAbi, multisigAbi, setKeeperAbi, timelockAbi } from "../testnet/abis";
import { MULTISIG, buildKeeperMarkets, testnetClient } from "../testnet/markets";

// Moves the keeper role to a dedicated key, so the service on Railway never
// holds the deployer key. Two authorisations, matching the two roles the
// keeper uses:
//
//   1. multisig signer    to pause/resume oracles (the multisig owns them).
//                         addSigner is onlySelf, so the multisig proposes a
//                         call to itself and executes it (1-of-1).
//   2. HaltController.keeper on each market, for beginHalting/completeResume.
//                         setKeeper is onlyOwner and the owner is the
//                         timelock: the multisig schedules one batch for all
//                         five, and after minDelay (600s) anyone executes it.
//
// Idempotent: run it, and run it again. Each run reads what's already done and
// does the next step. --wait sleeps through the timelock delay so a single
// run finishes the job.
//
//   ADMIN_PRIVATE_KEY=<deployer key> npm run authorize-keeper -- --keeper 0xNEW [--fund 0.05] [--wait]
//
// ADMIN_PRIVATE_KEY must be a multisig signer (today: the deployer). It is
// used for this one ceremony and is not needed by the running service.

const TIMELOCK = SHARED.timelock as `0x${string}`;
const ZERO32 = `0x${"00".repeat(32)}` as Hex;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const log = (msg: string) => console.log(msg);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const newKeeper = arg("keeper");
  if (!newKeeper || !isAddress(newKeeper)) throw new Error("--keeper <address> is required");
  const adminKey = process.env.ADMIN_PRIVATE_KEY?.trim();
  if (!adminKey) throw new Error("ADMIN_PRIVATE_KEY (a multisig signer, e.g. the deployer) is required");
  const admin = new Signer(adminKey);
  const markets = buildKeeperMarkets(
    (arg("markets") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const wait = process.argv.includes("--wait");

  log(`admin      ${admin.address}`);
  log(`new keeper ${newKeeper}`);
  log(`markets    ${markets.map((m) => m.key).join(", ")}\n`);

  const adminIsSigner = await testnetClient.readContract({
    address: MULTISIG,
    abi: multisigAbi,
    functionName: "isSigner",
    args: [admin.address],
  });
  if (!adminIsSigner) throw new Error(`${admin.address} is not a multisig signer; it cannot run this ceremony`);

  // --- 1. multisig signer ----------------------------------------------------
  const isSigner = await testnetClient.readContract({
    address: MULTISIG,
    abi: multisigAbi,
    functionName: "isSigner",
    args: [newKeeper],
  });
  if (isSigner) {
    log("✓ already a multisig signer");
  } else {
    log("… adding as multisig signer (multisig → multisig.addSigner)");
    await admin.viaMultisig(
      MULTISIG,
      encodeFunctionData({ abi: addSignerAbi, functionName: "addSigner", args: [newKeeper] }),
      "addSigner",
    );
    log("✓ added as multisig signer");
  }

  // --- 2. HaltController.keeper, through the timelock ------------------------
  const current = await Promise.all(
    markets.map((m) =>
      testnetClient.readContract({ address: m.haltController, abi: haltControllerAbi, functionName: "keeper" }),
    ),
  );
  const todo = markets.filter((_, i) => current[i].toLowerCase() !== newKeeper.toLowerCase());
  for (const m of markets.filter((m) => !todo.includes(m))) log(`✓ ${m.key}: already keeper`);

  if (todo.length > 0) {
    const targets = todo.map((m) => m.haltController);
    const values = todo.map(() => 0n);
    const payloads = todo.map(() => encodeFunctionData({ abi: setKeeperAbi, functionName: "setKeeper", args: [newKeeper] }));
    // Deterministic salt, so a rerun finds the operation it scheduled before.
    const salt = keccak256(toHex(`haltgate:setKeeper:${newKeeper.toLowerCase()}:${targets.join(",").toLowerCase()}`));
    const id = await testnetClient.readContract({
      address: TIMELOCK,
      abi: timelockAbi,
      functionName: "hashOperationBatch",
      args: [targets, values, payloads, ZERO32, salt],
    });

    let readyAt = await testnetClient.readContract({ address: TIMELOCK, abi: timelockAbi, functionName: "getTimestamp", args: [id] });
    if (readyAt === 1n) {
      throw new Error(`timelock operation ${id} already executed, yet ${todo.map((m) => m.key).join(",")} still differ. Someone changed the keeper since; investigate before retrying`);
    }
    if (readyAt === 0n) {
      const delay = await testnetClient.readContract({ address: TIMELOCK, abi: timelockAbi, functionName: "getMinDelay" });
      log(`… scheduling setKeeper on ${todo.map((m) => m.key).join(", ")} (multisig → timelock.scheduleBatch, delay ${delay}s)`);
      await admin.viaMultisig(
        TIMELOCK,
        encodeFunctionData({
          abi: timelockAbi,
          functionName: "scheduleBatch",
          args: [targets, values, payloads, ZERO32, salt, delay],
        }),
        "scheduleBatch",
      );
      // The public RPC load-balances across nodes, and a read straight after a
      // write can land on one that hasn't seen it yet and report 0. Acting on
      // that once tried to execute immediately (the timelock rightly refused).
      for (let i = 0; i < 20 && readyAt === 0n; i++) {
        await sleep(3000);
        readyAt = await testnetClient.readContract({ address: TIMELOCK, abi: timelockAbi, functionName: "getTimestamp", args: [id] });
      }
      if (readyAt === 0n) throw new Error(`scheduled, but the RPC doesn't show operation ${id} yet; rerun in a minute`);
      log(`✓ scheduled, operation ${id}`);
    }
    if (readyAt <= 1n) throw new Error(`unexpected timelock state ${readyAt} for ${id}`);

    const chainNow = async () => Number((await testnetClient.getBlock()).timestamp);
    let now = await chainNow();
    if (now < Number(readyAt)) {
      const left = Number(readyAt) - now;
      if (!wait) {
        log(`\n⏳ timelock ready at ${new Date(Number(readyAt) * 1000).toISOString()} (in ${left}s). Run this again then, or pass --wait.`);
        return;
      }
      log(`… waiting ${left}s for the timelock delay`);
      while (now < Number(readyAt)) {
        await sleep(Math.min(30_000, (Number(readyAt) - now + 3) * 1000));
        now = await chainNow();
      }
    }

    log("… executing (timelock.executeBatch, open to anyone)");
    await admin.send(
      TIMELOCK,
      encodeFunctionData({ abi: timelockAbi, functionName: "executeBatch", args: [targets, values, payloads, ZERO32, salt] }),
      "executeBatch",
    );
    log(`✓ keeper set on ${todo.map((m) => m.key).join(", ")}`);
  }

  // --- 3. gas ----------------------------------------------------------------
  const fund = arg("fund");
  if (fund) {
    const want = parseEther(fund);
    const have = await testnetClient.getBalance({ address: newKeeper });
    if (have >= want) {
      log(`✓ keeper already holds ${formatEther(have)} OKB`);
    } else {
      await admin.transfer(newKeeper, want - have, "fund keeper");
      log(`✓ funded keeper up to ${fund} OKB`);
    }
  }

  // --- verify ----------------------------------------------------------------
  log("\nfinal state:");
  log(`  multisig signer: ${await testnetClient.readContract({ address: MULTISIG, abi: multisigAbi, functionName: "isSigner", args: [newKeeper] })}`);
  for (const m of markets) {
    const k = await testnetClient.readContract({ address: m.haltController, abi: haltControllerAbi, functionName: "keeper" });
    log(`  ${m.key.padEnd(5)} keeper: ${k}${k.toLowerCase() === newKeeper.toLowerCase() ? "  ✓" : "  ✗"}`);
  }
  log(`  balance: ${formatEther(await testnetClient.getBalance({ address: newKeeper }))} OKB`);
}

main().catch((err) => {
  console.error(`\n✗ ${(err as Error).message}`);
  process.exit(1);
});
