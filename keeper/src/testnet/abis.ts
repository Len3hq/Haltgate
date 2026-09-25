import type { Abi } from "viem";

// Only the functions the keeper calls, checked against src/ in this repo.

export const haltControllerAbi = [
  { type: "function", name: "state", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "haltStartedAt", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "keeper", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "owner", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "beginHalting", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "sync", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "completeResume", inputs: [], outputs: [], stateMutability: "nonpayable" },
] as const satisfies Abi;

export const oracleAbi = [
  {
    type: "function",
    name: "latestPrice",
    inputs: [],
    outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxNormalUpdateDeviationBps",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  { type: "function", name: "pauseOracle", inputs: [], outputs: [], stateMutability: "nonpayable" },
  {
    type: "function",
    name: "resumeOracle",
    inputs: [{ type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  { type: "function", name: "setPrice", inputs: [{ type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
] as const satisfies Abi;

export const marketAbi = [
  { type: "function", name: "isSystemSolvent", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "maxOracleStaleness", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const satisfies Abi;

export const multisigAbi = [
  {
    type: "function",
    name: "propose",
    inputs: [{ type: "address" }, { type: "uint256" }, { type: "bytes" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  { type: "function", name: "execute", inputs: [{ type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "isSigner", inputs: [{ type: "address" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "threshold", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "event",
    name: "TransactionProposed",
    inputs: [
      { name: "txId", type: "uint256", indexed: true },
      { name: "proposer", type: "address", indexed: true },
      { name: "target", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
      { name: "data", type: "bytes", indexed: false },
    ],
  },
] as const satisfies Abi;

/// Governance calls, for tools/authorize-keeper.ts only.
export const setKeeperAbi = [
  { type: "function", name: "setKeeper", inputs: [{ type: "address" }], outputs: [], stateMutability: "nonpayable" },
] as const satisfies Abi;

export const addSignerAbi = [
  { type: "function", name: "addSigner", inputs: [{ type: "address" }], outputs: [], stateMutability: "nonpayable" },
] as const satisfies Abi;

/// OpenZeppelin TimelockController (v5). On this deployment the multisig is
/// the only proposer, execution is open to anyone, and minDelay is 600s.
export const timelockAbi = [
  { type: "function", name: "getMinDelay", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function",
    name: "getTimestamp",
    inputs: [{ type: "bytes32" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hashOperationBatch",
    inputs: [
      { type: "address[]" },
      { type: "uint256[]" },
      { type: "bytes[]" },
      { type: "bytes32" },
      { type: "bytes32" },
    ],
    outputs: [{ type: "bytes32" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "scheduleBatch",
    inputs: [
      { type: "address[]" },
      { type: "uint256[]" },
      { type: "bytes[]" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "executeBatch",
    inputs: [
      { type: "address[]" },
      { type: "uint256[]" },
      { type: "bytes[]" },
      { type: "bytes32" },
      { type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const satisfies Abi;

export const multicall3TimestampAbi = [
  {
    type: "function",
    name: "getCurrentBlockTimestamp",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const satisfies Abi;
