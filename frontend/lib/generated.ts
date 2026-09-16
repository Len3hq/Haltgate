import {
  createUseReadContract,
  createUseWriteContract,
  createUseSimulateContract,
  createUseWatchContractEvent,
} from 'wagmi/codegen'

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// HaltController
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const haltControllerAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'oracle_', internalType: 'address', type: 'address' },
      { name: 'owner_', internalType: 'address', type: 'address' },
      { name: 'keeper_', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'beginHalting',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'canLiquidate',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'canRepay',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'canSupplyOrBorrow',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'completeResume',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'reason', internalType: 'string', type: 'string' }],
    name: 'forceResume',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'isHalted',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'keeper',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'oracle',
    outputs: [
      { name: '', internalType: 'contract IPausableOracle', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newKeeper', internalType: 'address', type: 'address' }],
    name: 'setKeeper',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'state',
    outputs: [
      {
        name: '',
        internalType: 'enum HaltController.MarketState',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'sync',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'by', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'reasonHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
      {
        name: 'reason',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
    ],
    name: 'ForceResumed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previous',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'next', internalType: 'address', type: 'address', indexed: true },
    ],
    name: 'KeeperUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previous',
        internalType: 'enum HaltController.MarketState',
        type: 'uint8',
        indexed: true,
      },
      {
        name: 'next',
        internalType: 'enum HaltController.MarketState',
        type: 'uint8',
        indexed: true,
      },
    ],
    name: 'StateChanged',
  },
  { type: 'error', inputs: [], name: 'NotAuthorized' },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'OwnableInvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
  },
  {
    type: 'error',
    inputs: [
      {
        name: 'required',
        internalType: 'enum HaltController.MarketState',
        type: 'uint8',
      },
      {
        name: 'actual',
        internalType: 'enum HaltController.MarketState',
        type: 'uint8',
      },
    ],
    name: 'WrongState',
  },
  { type: 'error', inputs: [], name: 'ZeroAddress' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IPausableOracle
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const iPausableOracleAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'isPaused',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'latestPrice',
    outputs: [
      { name: 'price', internalType: 'uint256', type: 'uint256' },
      { name: 'updatedAt', internalType: 'uint256', type: 'uint256' },
      { name: 'paused', internalType: 'bool', type: 'bool' },
    ],
    stateMutability: 'view',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Market
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const marketAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'collateralToken_', internalType: 'address', type: 'address' },
      { name: 'debtToken_', internalType: 'address', type: 'address' },
      { name: 'oracle_', internalType: 'address', type: 'address' },
      { name: 'haltController_', internalType: 'address', type: 'address' },
      { name: 'owner_', internalType: 'address', type: 'address' },
      { name: 'maxLTV_', internalType: 'uint256', type: 'uint256' },
      {
        name: 'liquidationThreshold_',
        internalType: 'uint256',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'CLOSE_FACTOR',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'borrow',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'collateralDecimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'collateralToken',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'debtDecimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'debtToken',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'fundMarket',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'haltController',
    outputs: [
      { name: '', internalType: 'contract HaltController', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
    name: 'healthFactor',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
    name: 'isLiquidatable',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'isSystemSolvent',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'user', internalType: 'address', type: 'address' },
      { name: 'repayAmount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'liquidate',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'liquidationBonus',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'liquidationThreshold',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'maxLTV',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'maxOracleStaleness',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'oracle',
    outputs: [
      { name: '', internalType: 'contract IPausableOracle', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'positions',
    outputs: [
      { name: 'collateral', internalType: 'uint256', type: 'uint256' },
      { name: 'debt', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'repay',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newBonus', internalType: 'uint256', type: 'uint256' }],
    name: 'setLiquidationBonus',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newMaxStaleness', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'setMaxOracleStaleness',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newMaxLTV', internalType: 'uint256', type: 'uint256' },
      {
        name: 'newLiquidationThreshold',
        internalType: 'uint256',
        type: 'uint256',
      },
    ],
    name: 'setRiskParams',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'supply',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalCollateral',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalDebt',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Borrowed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'liquidator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'debtRepaid',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'collateralSeized',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Liquidated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newBonus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'LiquidationBonusUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newMaxStaleness',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'MaxOracleStalenessUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Repaid',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'maxLTV',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'liquidationThreshold',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'RiskParamsUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Supplied',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Withdrawn',
  },
  { type: 'error', inputs: [], name: 'ExceedsMaxLTV' },
  { type: 'error', inputs: [], name: 'InsufficientCollateral' },
  { type: 'error', inputs: [], name: 'InvalidRiskParams' },
  { type: 'error', inputs: [], name: 'MarketHalted' },
  { type: 'error', inputs: [], name: 'NotLiquidatable' },
  { type: 'error', inputs: [], name: 'OraclePausedDirectly' },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'OwnableInvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
  },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  {
    type: 'error',
    inputs: [
      { name: 'lastUpdated', internalType: 'uint256', type: 'uint256' },
      { name: 'maxStaleness', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'StaleOracle',
  },
  { type: 'error', inputs: [], name: 'UnsupportedDecimals' },
  { type: 'error', inputs: [], name: 'ZeroAmount' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MockUSDG
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const mockUsdgAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'owner_', internalType: 'address', type: 'address' },
      { name: 'decimals_', internalType: 'uint8', type: 'uint8' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Transfer',
  },
  {
    type: 'error',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'allowance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC20InsufficientAllowance',
  },
  {
    type: 'error',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC20InsufficientBalance',
  },
  {
    type: 'error',
    inputs: [{ name: 'approver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidApprover',
  },
  {
    type: 'error',
    inputs: [{ name: 'receiver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidReceiver',
  },
  {
    type: 'error',
    inputs: [{ name: 'sender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSender',
  },
  {
    type: 'error',
    inputs: [{ name: 'spender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSpender',
  },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'OwnableInvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MockWrappedXStock
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const mockWrappedXStockAbi = [
  {
    type: 'constructor',
    inputs: [{ name: 'owner_', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'exchangeRate',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newRate', internalType: 'uint256', type: 'uint256' }],
    name: 'setExchangeRate',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'shares', internalType: 'uint256', type: 'uint256' }],
    name: 'valueOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousRate',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'newRate',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'ExchangeRateUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Transfer',
  },
  {
    type: 'error',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'allowance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC20InsufficientAllowance',
  },
  {
    type: 'error',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC20InsufficientBalance',
  },
  {
    type: 'error',
    inputs: [{ name: 'approver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidApprover',
  },
  {
    type: 'error',
    inputs: [{ name: 'receiver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidReceiver',
  },
  {
    type: 'error',
    inputs: [{ name: 'sender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSender',
  },
  {
    type: 'error',
    inputs: [{ name: 'spender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSpender',
  },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'OwnableInvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// React
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link haltControllerAbi}__
 */
export const useReadHaltController = /*#__PURE__*/ createUseReadContract({
  abi: haltControllerAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"canLiquidate"`
 */
export const useReadHaltControllerCanLiquidate =
  /*#__PURE__*/ createUseReadContract({
    abi: haltControllerAbi,
    functionName: 'canLiquidate',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"canRepay"`
 */
export const useReadHaltControllerCanRepay =
  /*#__PURE__*/ createUseReadContract({
    abi: haltControllerAbi,
    functionName: 'canRepay',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"canSupplyOrBorrow"`
 */
export const useReadHaltControllerCanSupplyOrBorrow =
  /*#__PURE__*/ createUseReadContract({
    abi: haltControllerAbi,
    functionName: 'canSupplyOrBorrow',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"isHalted"`
 */
export const useReadHaltControllerIsHalted =
  /*#__PURE__*/ createUseReadContract({
    abi: haltControllerAbi,
    functionName: 'isHalted',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"keeper"`
 */
export const useReadHaltControllerKeeper = /*#__PURE__*/ createUseReadContract({
  abi: haltControllerAbi,
  functionName: 'keeper',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"oracle"`
 */
export const useReadHaltControllerOracle = /*#__PURE__*/ createUseReadContract({
  abi: haltControllerAbi,
  functionName: 'oracle',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"owner"`
 */
export const useReadHaltControllerOwner = /*#__PURE__*/ createUseReadContract({
  abi: haltControllerAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"state"`
 */
export const useReadHaltControllerState = /*#__PURE__*/ createUseReadContract({
  abi: haltControllerAbi,
  functionName: 'state',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link haltControllerAbi}__
 */
export const useWriteHaltController = /*#__PURE__*/ createUseWriteContract({
  abi: haltControllerAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"beginHalting"`
 */
export const useWriteHaltControllerBeginHalting =
  /*#__PURE__*/ createUseWriteContract({
    abi: haltControllerAbi,
    functionName: 'beginHalting',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"completeResume"`
 */
export const useWriteHaltControllerCompleteResume =
  /*#__PURE__*/ createUseWriteContract({
    abi: haltControllerAbi,
    functionName: 'completeResume',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"forceResume"`
 */
export const useWriteHaltControllerForceResume =
  /*#__PURE__*/ createUseWriteContract({
    abi: haltControllerAbi,
    functionName: 'forceResume',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useWriteHaltControllerRenounceOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: haltControllerAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"setKeeper"`
 */
export const useWriteHaltControllerSetKeeper =
  /*#__PURE__*/ createUseWriteContract({
    abi: haltControllerAbi,
    functionName: 'setKeeper',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"sync"`
 */
export const useWriteHaltControllerSync = /*#__PURE__*/ createUseWriteContract({
  abi: haltControllerAbi,
  functionName: 'sync',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useWriteHaltControllerTransferOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: haltControllerAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link haltControllerAbi}__
 */
export const useSimulateHaltController =
  /*#__PURE__*/ createUseSimulateContract({ abi: haltControllerAbi })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"beginHalting"`
 */
export const useSimulateHaltControllerBeginHalting =
  /*#__PURE__*/ createUseSimulateContract({
    abi: haltControllerAbi,
    functionName: 'beginHalting',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"completeResume"`
 */
export const useSimulateHaltControllerCompleteResume =
  /*#__PURE__*/ createUseSimulateContract({
    abi: haltControllerAbi,
    functionName: 'completeResume',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"forceResume"`
 */
export const useSimulateHaltControllerForceResume =
  /*#__PURE__*/ createUseSimulateContract({
    abi: haltControllerAbi,
    functionName: 'forceResume',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useSimulateHaltControllerRenounceOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: haltControllerAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"setKeeper"`
 */
export const useSimulateHaltControllerSetKeeper =
  /*#__PURE__*/ createUseSimulateContract({
    abi: haltControllerAbi,
    functionName: 'setKeeper',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"sync"`
 */
export const useSimulateHaltControllerSync =
  /*#__PURE__*/ createUseSimulateContract({
    abi: haltControllerAbi,
    functionName: 'sync',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link haltControllerAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useSimulateHaltControllerTransferOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: haltControllerAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link haltControllerAbi}__
 */
export const useWatchHaltControllerEvent =
  /*#__PURE__*/ createUseWatchContractEvent({ abi: haltControllerAbi })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link haltControllerAbi}__ and `eventName` set to `"ForceResumed"`
 */
export const useWatchHaltControllerForceResumedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: haltControllerAbi,
    eventName: 'ForceResumed',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link haltControllerAbi}__ and `eventName` set to `"KeeperUpdated"`
 */
export const useWatchHaltControllerKeeperUpdatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: haltControllerAbi,
    eventName: 'KeeperUpdated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link haltControllerAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const useWatchHaltControllerOwnershipTransferredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: haltControllerAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link haltControllerAbi}__ and `eventName` set to `"StateChanged"`
 */
export const useWatchHaltControllerStateChangedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: haltControllerAbi,
    eventName: 'StateChanged',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link iPausableOracleAbi}__
 */
export const useReadIPausableOracle = /*#__PURE__*/ createUseReadContract({
  abi: iPausableOracleAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link iPausableOracleAbi}__ and `functionName` set to `"isPaused"`
 */
export const useReadIPausableOracleIsPaused =
  /*#__PURE__*/ createUseReadContract({
    abi: iPausableOracleAbi,
    functionName: 'isPaused',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link iPausableOracleAbi}__ and `functionName` set to `"latestPrice"`
 */
export const useReadIPausableOracleLatestPrice =
  /*#__PURE__*/ createUseReadContract({
    abi: iPausableOracleAbi,
    functionName: 'latestPrice',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__
 */
export const useReadMarket = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"CLOSE_FACTOR"`
 */
export const useReadMarketCloseFactor = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'CLOSE_FACTOR',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"collateralDecimals"`
 */
export const useReadMarketCollateralDecimals =
  /*#__PURE__*/ createUseReadContract({
    abi: marketAbi,
    functionName: 'collateralDecimals',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"collateralToken"`
 */
export const useReadMarketCollateralToken = /*#__PURE__*/ createUseReadContract(
  { abi: marketAbi, functionName: 'collateralToken' },
)

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"debtDecimals"`
 */
export const useReadMarketDebtDecimals = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'debtDecimals',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"debtToken"`
 */
export const useReadMarketDebtToken = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'debtToken',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"haltController"`
 */
export const useReadMarketHaltController = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'haltController',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"healthFactor"`
 */
export const useReadMarketHealthFactor = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'healthFactor',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"isLiquidatable"`
 */
export const useReadMarketIsLiquidatable = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'isLiquidatable',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"isSystemSolvent"`
 */
export const useReadMarketIsSystemSolvent = /*#__PURE__*/ createUseReadContract(
  { abi: marketAbi, functionName: 'isSystemSolvent' },
)

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"liquidationBonus"`
 */
export const useReadMarketLiquidationBonus =
  /*#__PURE__*/ createUseReadContract({
    abi: marketAbi,
    functionName: 'liquidationBonus',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"liquidationThreshold"`
 */
export const useReadMarketLiquidationThreshold =
  /*#__PURE__*/ createUseReadContract({
    abi: marketAbi,
    functionName: 'liquidationThreshold',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"maxLTV"`
 */
export const useReadMarketMaxLtv = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'maxLTV',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"maxOracleStaleness"`
 */
export const useReadMarketMaxOracleStaleness =
  /*#__PURE__*/ createUseReadContract({
    abi: marketAbi,
    functionName: 'maxOracleStaleness',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"oracle"`
 */
export const useReadMarketOracle = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'oracle',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"owner"`
 */
export const useReadMarketOwner = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"positions"`
 */
export const useReadMarketPositions = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'positions',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"totalCollateral"`
 */
export const useReadMarketTotalCollateral = /*#__PURE__*/ createUseReadContract(
  { abi: marketAbi, functionName: 'totalCollateral' },
)

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"totalDebt"`
 */
export const useReadMarketTotalDebt = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'totalDebt',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__
 */
export const useWriteMarket = /*#__PURE__*/ createUseWriteContract({
  abi: marketAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"borrow"`
 */
export const useWriteMarketBorrow = /*#__PURE__*/ createUseWriteContract({
  abi: marketAbi,
  functionName: 'borrow',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"fundMarket"`
 */
export const useWriteMarketFundMarket = /*#__PURE__*/ createUseWriteContract({
  abi: marketAbi,
  functionName: 'fundMarket',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"liquidate"`
 */
export const useWriteMarketLiquidate = /*#__PURE__*/ createUseWriteContract({
  abi: marketAbi,
  functionName: 'liquidate',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useWriteMarketRenounceOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: marketAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"repay"`
 */
export const useWriteMarketRepay = /*#__PURE__*/ createUseWriteContract({
  abi: marketAbi,
  functionName: 'repay',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"setLiquidationBonus"`
 */
export const useWriteMarketSetLiquidationBonus =
  /*#__PURE__*/ createUseWriteContract({
    abi: marketAbi,
    functionName: 'setLiquidationBonus',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"setMaxOracleStaleness"`
 */
export const useWriteMarketSetMaxOracleStaleness =
  /*#__PURE__*/ createUseWriteContract({
    abi: marketAbi,
    functionName: 'setMaxOracleStaleness',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"setRiskParams"`
 */
export const useWriteMarketSetRiskParams = /*#__PURE__*/ createUseWriteContract(
  { abi: marketAbi, functionName: 'setRiskParams' },
)

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"supply"`
 */
export const useWriteMarketSupply = /*#__PURE__*/ createUseWriteContract({
  abi: marketAbi,
  functionName: 'supply',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useWriteMarketTransferOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: marketAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"withdraw"`
 */
export const useWriteMarketWithdraw = /*#__PURE__*/ createUseWriteContract({
  abi: marketAbi,
  functionName: 'withdraw',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__
 */
export const useSimulateMarket = /*#__PURE__*/ createUseSimulateContract({
  abi: marketAbi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"borrow"`
 */
export const useSimulateMarketBorrow = /*#__PURE__*/ createUseSimulateContract({
  abi: marketAbi,
  functionName: 'borrow',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"fundMarket"`
 */
export const useSimulateMarketFundMarket =
  /*#__PURE__*/ createUseSimulateContract({
    abi: marketAbi,
    functionName: 'fundMarket',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"liquidate"`
 */
export const useSimulateMarketLiquidate =
  /*#__PURE__*/ createUseSimulateContract({
    abi: marketAbi,
    functionName: 'liquidate',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useSimulateMarketRenounceOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: marketAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"repay"`
 */
export const useSimulateMarketRepay = /*#__PURE__*/ createUseSimulateContract({
  abi: marketAbi,
  functionName: 'repay',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"setLiquidationBonus"`
 */
export const useSimulateMarketSetLiquidationBonus =
  /*#__PURE__*/ createUseSimulateContract({
    abi: marketAbi,
    functionName: 'setLiquidationBonus',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"setMaxOracleStaleness"`
 */
export const useSimulateMarketSetMaxOracleStaleness =
  /*#__PURE__*/ createUseSimulateContract({
    abi: marketAbi,
    functionName: 'setMaxOracleStaleness',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"setRiskParams"`
 */
export const useSimulateMarketSetRiskParams =
  /*#__PURE__*/ createUseSimulateContract({
    abi: marketAbi,
    functionName: 'setRiskParams',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"supply"`
 */
export const useSimulateMarketSupply = /*#__PURE__*/ createUseSimulateContract({
  abi: marketAbi,
  functionName: 'supply',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useSimulateMarketTransferOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: marketAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"withdraw"`
 */
export const useSimulateMarketWithdraw =
  /*#__PURE__*/ createUseSimulateContract({
    abi: marketAbi,
    functionName: 'withdraw',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__
 */
export const useWatchMarketEvent = /*#__PURE__*/ createUseWatchContractEvent({
  abi: marketAbi,
})

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__ and `eventName` set to `"Borrowed"`
 */
export const useWatchMarketBorrowedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: marketAbi,
    eventName: 'Borrowed',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__ and `eventName` set to `"Liquidated"`
 */
export const useWatchMarketLiquidatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: marketAbi,
    eventName: 'Liquidated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__ and `eventName` set to `"LiquidationBonusUpdated"`
 */
export const useWatchMarketLiquidationBonusUpdatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: marketAbi,
    eventName: 'LiquidationBonusUpdated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__ and `eventName` set to `"MaxOracleStalenessUpdated"`
 */
export const useWatchMarketMaxOracleStalenessUpdatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: marketAbi,
    eventName: 'MaxOracleStalenessUpdated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const useWatchMarketOwnershipTransferredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: marketAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__ and `eventName` set to `"Repaid"`
 */
export const useWatchMarketRepaidEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: marketAbi,
    eventName: 'Repaid',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__ and `eventName` set to `"RiskParamsUpdated"`
 */
export const useWatchMarketRiskParamsUpdatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: marketAbi,
    eventName: 'RiskParamsUpdated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__ and `eventName` set to `"Supplied"`
 */
export const useWatchMarketSuppliedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: marketAbi,
    eventName: 'Supplied',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__ and `eventName` set to `"Withdrawn"`
 */
export const useWatchMarketWithdrawnEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: marketAbi,
    eventName: 'Withdrawn',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockUsdgAbi}__
 */
export const useReadMockUsdg = /*#__PURE__*/ createUseReadContract({
  abi: mockUsdgAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"allowance"`
 */
export const useReadMockUsdgAllowance = /*#__PURE__*/ createUseReadContract({
  abi: mockUsdgAbi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"balanceOf"`
 */
export const useReadMockUsdgBalanceOf = /*#__PURE__*/ createUseReadContract({
  abi: mockUsdgAbi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"decimals"`
 */
export const useReadMockUsdgDecimals = /*#__PURE__*/ createUseReadContract({
  abi: mockUsdgAbi,
  functionName: 'decimals',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"name"`
 */
export const useReadMockUsdgName = /*#__PURE__*/ createUseReadContract({
  abi: mockUsdgAbi,
  functionName: 'name',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"owner"`
 */
export const useReadMockUsdgOwner = /*#__PURE__*/ createUseReadContract({
  abi: mockUsdgAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"symbol"`
 */
export const useReadMockUsdgSymbol = /*#__PURE__*/ createUseReadContract({
  abi: mockUsdgAbi,
  functionName: 'symbol',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"totalSupply"`
 */
export const useReadMockUsdgTotalSupply = /*#__PURE__*/ createUseReadContract({
  abi: mockUsdgAbi,
  functionName: 'totalSupply',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockUsdgAbi}__
 */
export const useWriteMockUsdg = /*#__PURE__*/ createUseWriteContract({
  abi: mockUsdgAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"approve"`
 */
export const useWriteMockUsdgApprove = /*#__PURE__*/ createUseWriteContract({
  abi: mockUsdgAbi,
  functionName: 'approve',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"mint"`
 */
export const useWriteMockUsdgMint = /*#__PURE__*/ createUseWriteContract({
  abi: mockUsdgAbi,
  functionName: 'mint',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useWriteMockUsdgRenounceOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: mockUsdgAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"transfer"`
 */
export const useWriteMockUsdgTransfer = /*#__PURE__*/ createUseWriteContract({
  abi: mockUsdgAbi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"transferFrom"`
 */
export const useWriteMockUsdgTransferFrom =
  /*#__PURE__*/ createUseWriteContract({
    abi: mockUsdgAbi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useWriteMockUsdgTransferOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: mockUsdgAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockUsdgAbi}__
 */
export const useSimulateMockUsdg = /*#__PURE__*/ createUseSimulateContract({
  abi: mockUsdgAbi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"approve"`
 */
export const useSimulateMockUsdgApprove =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockUsdgAbi,
    functionName: 'approve',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"mint"`
 */
export const useSimulateMockUsdgMint = /*#__PURE__*/ createUseSimulateContract({
  abi: mockUsdgAbi,
  functionName: 'mint',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useSimulateMockUsdgRenounceOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockUsdgAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"transfer"`
 */
export const useSimulateMockUsdgTransfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockUsdgAbi,
    functionName: 'transfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"transferFrom"`
 */
export const useSimulateMockUsdgTransferFrom =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockUsdgAbi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockUsdgAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useSimulateMockUsdgTransferOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockUsdgAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link mockUsdgAbi}__
 */
export const useWatchMockUsdgEvent = /*#__PURE__*/ createUseWatchContractEvent({
  abi: mockUsdgAbi,
})

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link mockUsdgAbi}__ and `eventName` set to `"Approval"`
 */
export const useWatchMockUsdgApprovalEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: mockUsdgAbi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link mockUsdgAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const useWatchMockUsdgOwnershipTransferredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: mockUsdgAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link mockUsdgAbi}__ and `eventName` set to `"Transfer"`
 */
export const useWatchMockUsdgTransferEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: mockUsdgAbi,
    eventName: 'Transfer',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__
 */
export const useReadMockWrappedXStock = /*#__PURE__*/ createUseReadContract({
  abi: mockWrappedXStockAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"allowance"`
 */
export const useReadMockWrappedXStockAllowance =
  /*#__PURE__*/ createUseReadContract({
    abi: mockWrappedXStockAbi,
    functionName: 'allowance',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"balanceOf"`
 */
export const useReadMockWrappedXStockBalanceOf =
  /*#__PURE__*/ createUseReadContract({
    abi: mockWrappedXStockAbi,
    functionName: 'balanceOf',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"decimals"`
 */
export const useReadMockWrappedXStockDecimals =
  /*#__PURE__*/ createUseReadContract({
    abi: mockWrappedXStockAbi,
    functionName: 'decimals',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"exchangeRate"`
 */
export const useReadMockWrappedXStockExchangeRate =
  /*#__PURE__*/ createUseReadContract({
    abi: mockWrappedXStockAbi,
    functionName: 'exchangeRate',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"name"`
 */
export const useReadMockWrappedXStockName = /*#__PURE__*/ createUseReadContract(
  { abi: mockWrappedXStockAbi, functionName: 'name' },
)

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"owner"`
 */
export const useReadMockWrappedXStockOwner =
  /*#__PURE__*/ createUseReadContract({
    abi: mockWrappedXStockAbi,
    functionName: 'owner',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"symbol"`
 */
export const useReadMockWrappedXStockSymbol =
  /*#__PURE__*/ createUseReadContract({
    abi: mockWrappedXStockAbi,
    functionName: 'symbol',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"totalSupply"`
 */
export const useReadMockWrappedXStockTotalSupply =
  /*#__PURE__*/ createUseReadContract({
    abi: mockWrappedXStockAbi,
    functionName: 'totalSupply',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"valueOf"`
 */
export const useReadMockWrappedXStockValueOf =
  /*#__PURE__*/ createUseReadContract({
    abi: mockWrappedXStockAbi,
    functionName: 'valueOf',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__
 */
export const useWriteMockWrappedXStock = /*#__PURE__*/ createUseWriteContract({
  abi: mockWrappedXStockAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"approve"`
 */
export const useWriteMockWrappedXStockApprove =
  /*#__PURE__*/ createUseWriteContract({
    abi: mockWrappedXStockAbi,
    functionName: 'approve',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"mint"`
 */
export const useWriteMockWrappedXStockMint =
  /*#__PURE__*/ createUseWriteContract({
    abi: mockWrappedXStockAbi,
    functionName: 'mint',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useWriteMockWrappedXStockRenounceOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: mockWrappedXStockAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"setExchangeRate"`
 */
export const useWriteMockWrappedXStockSetExchangeRate =
  /*#__PURE__*/ createUseWriteContract({
    abi: mockWrappedXStockAbi,
    functionName: 'setExchangeRate',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"transfer"`
 */
export const useWriteMockWrappedXStockTransfer =
  /*#__PURE__*/ createUseWriteContract({
    abi: mockWrappedXStockAbi,
    functionName: 'transfer',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"transferFrom"`
 */
export const useWriteMockWrappedXStockTransferFrom =
  /*#__PURE__*/ createUseWriteContract({
    abi: mockWrappedXStockAbi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useWriteMockWrappedXStockTransferOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: mockWrappedXStockAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__
 */
export const useSimulateMockWrappedXStock =
  /*#__PURE__*/ createUseSimulateContract({ abi: mockWrappedXStockAbi })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"approve"`
 */
export const useSimulateMockWrappedXStockApprove =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockWrappedXStockAbi,
    functionName: 'approve',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"mint"`
 */
export const useSimulateMockWrappedXStockMint =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockWrappedXStockAbi,
    functionName: 'mint',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useSimulateMockWrappedXStockRenounceOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockWrappedXStockAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"setExchangeRate"`
 */
export const useSimulateMockWrappedXStockSetExchangeRate =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockWrappedXStockAbi,
    functionName: 'setExchangeRate',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"transfer"`
 */
export const useSimulateMockWrappedXStockTransfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockWrappedXStockAbi,
    functionName: 'transfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"transferFrom"`
 */
export const useSimulateMockWrappedXStockTransferFrom =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockWrappedXStockAbi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useSimulateMockWrappedXStockTransferOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockWrappedXStockAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link mockWrappedXStockAbi}__
 */
export const useWatchMockWrappedXStockEvent =
  /*#__PURE__*/ createUseWatchContractEvent({ abi: mockWrappedXStockAbi })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `eventName` set to `"Approval"`
 */
export const useWatchMockWrappedXStockApprovalEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: mockWrappedXStockAbi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `eventName` set to `"ExchangeRateUpdated"`
 */
export const useWatchMockWrappedXStockExchangeRateUpdatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: mockWrappedXStockAbi,
    eventName: 'ExchangeRateUpdated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const useWatchMockWrappedXStockOwnershipTransferredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: mockWrappedXStockAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link mockWrappedXStockAbi}__ and `eventName` set to `"Transfer"`
 */
export const useWatchMockWrappedXStockTransferEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: mockWrappedXStockAbi,
    eventName: 'Transfer',
  })
