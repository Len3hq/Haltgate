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
// InterestRateModel
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const interestRateModelAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'baseRatePerYear', internalType: 'uint256', type: 'uint256' },
      { name: 'multiplierPerYear', internalType: 'uint256', type: 'uint256' },
      {
        name: 'jumpMultiplierPerYear',
        internalType: 'uint256',
        type: 'uint256',
      },
      { name: 'kink_', internalType: 'uint256', type: 'uint256' },
      { name: 'owner_', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'baseRatePerSecond',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'cash', internalType: 'uint256', type: 'uint256' },
      { name: 'borrows', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'getBorrowRatePerSecond',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'cash', internalType: 'uint256', type: 'uint256' },
      { name: 'borrows', internalType: 'uint256', type: 'uint256' },
      { name: 'reserveFactor', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'getSupplyRatePerSecond',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'jumpMultiplierPerSecond',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'kink',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'multiplierPerSecond',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
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
    inputs: [
      { name: 'baseRatePerYear', internalType: 'uint256', type: 'uint256' },
      { name: 'multiplierPerYear', internalType: 'uint256', type: 'uint256' },
      {
        name: 'jumpMultiplierPerYear',
        internalType: 'uint256',
        type: 'uint256',
      },
      { name: 'kink_', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'setParams',
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
    type: 'function',
    inputs: [
      { name: 'cash', internalType: 'uint256', type: 'uint256' },
      { name: 'borrows', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'utilizationRate',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'pure',
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
        name: 'baseRatePerYear',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'multiplierPerYear',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'jumpMultiplierPerYear',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'kink',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'ParamsUpdated',
  },
  { type: 'error', inputs: [], name: 'InvalidKink' },
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
// LenderVault
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const lenderVaultAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'asset_', internalType: 'address', type: 'address' },
      { name: 'owner_', internalType: 'address', type: 'address' },
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
    inputs: [],
    name: 'asset',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
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
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'borrowCash',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'shares', internalType: 'uint256', type: 'uint256' }],
    name: 'convertToAssets',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'assets', internalType: 'uint256', type: 'uint256' }],
    name: 'convertToShares',
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
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
    ],
    name: 'deposit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'market',
    outputs: [{ name: '', internalType: 'contract Market', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'maxDeposit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'maxMint',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'owner_', internalType: 'address', type: 'address' }],
    name: 'maxRedeem',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'maxWithdraw',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
    ],
    name: 'mint',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
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
    inputs: [{ name: 'assets', internalType: 'uint256', type: 'uint256' }],
    name: 'previewDeposit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'shares', internalType: 'uint256', type: 'uint256' }],
    name: 'previewMint',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'shares', internalType: 'uint256', type: 'uint256' }],
    name: 'previewRedeem',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'assets', internalType: 'uint256', type: 'uint256' }],
    name: 'previewWithdraw',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'owner', internalType: 'address', type: 'address' },
    ],
    name: 'redeem',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
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
    inputs: [{ name: 'market_', internalType: 'address', type: 'address' }],
    name: 'setMarket',
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
    name: 'totalAssets',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
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
    inputs: [
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'owner', internalType: 'address', type: 'address' },
    ],
    name: 'withdraw',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
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
        name: 'sender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'assets',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Deposit',
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
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'sender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'receiver',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'assets',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Withdraw',
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
    inputs: [
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'max', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC4626ExceededMaxDeposit',
  },
  {
    type: 'error',
    inputs: [
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'max', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC4626ExceededMaxMint',
  },
  {
    type: 'error',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'max', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC4626ExceededMaxRedeem',
  },
  {
    type: 'error',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'max', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC4626ExceededMaxWithdraw',
  },
  { type: 'error', inputs: [], name: 'MarketAlreadySet' },
  { type: 'error', inputs: [], name: 'OnlyMarket' },
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
  { type: 'error', inputs: [], name: 'ZeroAddress' },
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
      { name: 'lenderVault_', internalType: 'address', type: 'address' },
      { name: 'interestRateModel_', internalType: 'address', type: 'address' },
      { name: 'owner_', internalType: 'address', type: 'address' },
      { name: 'maxLTV_', internalType: 'uint256', type: 'uint256' },
      {
        name: 'liquidationThreshold_',
        internalType: 'uint256',
        type: 'uint256',
      },
      { name: 'reserveFactor_', internalType: 'uint256', type: 'uint256' },
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
    inputs: [],
    name: 'accrueInterest',
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'borrowIndex',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
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
    inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
    name: 'currentDebt',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
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
    inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
    name: 'getPosition',
    outputs: [
      { name: 'collateral', internalType: 'uint256', type: 'uint256' },
      { name: 'debt', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
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
    inputs: [],
    name: 'interestRateModel',
    outputs: [
      { name: '', internalType: 'contract InterestRateModel', type: 'address' },
    ],
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
    inputs: [],
    name: 'lastAccrualTimestamp',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'lenderVault',
    outputs: [
      { name: '', internalType: 'contract LenderVault', type: 'address' },
    ],
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
    inputs: [],
    name: 'pendingBorrowsAndReserves',
    outputs: [
      { name: 'pendingTotalBorrows', internalType: 'uint256', type: 'uint256' },
      {
        name: 'pendingTotalReserves',
        internalType: 'uint256',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'positions',
    outputs: [
      { name: 'collateral', internalType: 'uint256', type: 'uint256' },
      { name: 'principal', internalType: 'uint256', type: 'uint256' },
      { name: 'borrowIndexSnapshot', internalType: 'uint256', type: 'uint256' },
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
    inputs: [],
    name: 'reserveFactor',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'newModel', internalType: 'address', type: 'address' }],
    name: 'setInterestRateModel',
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
      { name: 'newReserveFactor', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'setReserveFactor',
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
    name: 'totalBorrows',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
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
    name: 'totalReserves',
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
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'withdrawReserves',
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
      {
        name: 'interestAccumulated',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'reservesAdded',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'borrowIndex',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'totalBorrows',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'InterestAccrued',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newModel',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'InterestRateModelUpdated',
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
        name: 'newReserveFactor',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'ReserveFactorUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'ReservesWithdrawn',
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
  { type: 'error', inputs: [], name: 'InsufficientLiquidity' },
  { type: 'error', inputs: [], name: 'InsufficientReserves' },
  { type: 'error', inputs: [], name: 'InvalidReserveFactor' },
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
  { type: 'error', inputs: [], name: 'ZeroAddress' },
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
// SwapModule
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const swapModuleAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'collateralToken_', internalType: 'address', type: 'address' },
      { name: 'debtToken_', internalType: 'address', type: 'address' },
      { name: 'oracle_', internalType: 'address', type: 'address' },
      { name: 'haltController_', internalType: 'address', type: 'address' },
      { name: 'feeWad_', internalType: 'uint256', type: 'uint256' },
      { name: 'owner_', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_FEE',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
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
    inputs: [],
    name: 'feeWad',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
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
    inputs: [{ name: 'newFeeWad', internalType: 'uint256', type: 'uint256' }],
    name: 'setFee',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'collateralAmountIn', internalType: 'uint256', type: 'uint256' },
      { name: 'to', internalType: 'address', type: 'address' },
    ],
    name: 'swapCollateralForDebt',
    outputs: [{ name: 'debtOut', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'debtAmountIn', internalType: 'uint256', type: 'uint256' },
      { name: 'to', internalType: 'address', type: 'address' },
    ],
    name: 'swapDebtForCollateral',
    outputs: [
      { name: 'collateralOut', internalType: 'uint256', type: 'uint256' },
    ],
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
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'withdrawInventory',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previous',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'next',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'FeeUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'token',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'InventoryWithdrawn',
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
        name: 'caller',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'collateralForDebt',
        internalType: 'bool',
        type: 'bool',
        indexed: false,
      },
      {
        name: 'amountIn',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'amountOut',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Swapped',
  },
  { type: 'error', inputs: [], name: 'FeeTooHigh' },
  { type: 'error', inputs: [], name: 'InsufficientInventory' },
  { type: 'error', inputs: [], name: 'MarketHalted' },
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
  { type: 'error', inputs: [], name: 'ZeroAddress' },
  { type: 'error', inputs: [], name: 'ZeroAmount' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// WNVDAxFaucet
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const wnvdAxFaucetAbi = [
  {
    type: 'constructor',
    inputs: [{ name: 'token_', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'CLAIM_AMOUNT',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'hasClaimed',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'token',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Claimed',
  },
  { type: 'error', inputs: [], name: 'AlreadyClaimed' },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
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
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link interestRateModelAbi}__
 */
export const useReadInterestRateModel = /*#__PURE__*/ createUseReadContract({
  abi: interestRateModelAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"baseRatePerSecond"`
 */
export const useReadInterestRateModelBaseRatePerSecond =
  /*#__PURE__*/ createUseReadContract({
    abi: interestRateModelAbi,
    functionName: 'baseRatePerSecond',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"getBorrowRatePerSecond"`
 */
export const useReadInterestRateModelGetBorrowRatePerSecond =
  /*#__PURE__*/ createUseReadContract({
    abi: interestRateModelAbi,
    functionName: 'getBorrowRatePerSecond',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"getSupplyRatePerSecond"`
 */
export const useReadInterestRateModelGetSupplyRatePerSecond =
  /*#__PURE__*/ createUseReadContract({
    abi: interestRateModelAbi,
    functionName: 'getSupplyRatePerSecond',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"jumpMultiplierPerSecond"`
 */
export const useReadInterestRateModelJumpMultiplierPerSecond =
  /*#__PURE__*/ createUseReadContract({
    abi: interestRateModelAbi,
    functionName: 'jumpMultiplierPerSecond',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"kink"`
 */
export const useReadInterestRateModelKink = /*#__PURE__*/ createUseReadContract(
  { abi: interestRateModelAbi, functionName: 'kink' },
)

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"multiplierPerSecond"`
 */
export const useReadInterestRateModelMultiplierPerSecond =
  /*#__PURE__*/ createUseReadContract({
    abi: interestRateModelAbi,
    functionName: 'multiplierPerSecond',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"owner"`
 */
export const useReadInterestRateModelOwner =
  /*#__PURE__*/ createUseReadContract({
    abi: interestRateModelAbi,
    functionName: 'owner',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"utilizationRate"`
 */
export const useReadInterestRateModelUtilizationRate =
  /*#__PURE__*/ createUseReadContract({
    abi: interestRateModelAbi,
    functionName: 'utilizationRate',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link interestRateModelAbi}__
 */
export const useWriteInterestRateModel = /*#__PURE__*/ createUseWriteContract({
  abi: interestRateModelAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useWriteInterestRateModelRenounceOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: interestRateModelAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"setParams"`
 */
export const useWriteInterestRateModelSetParams =
  /*#__PURE__*/ createUseWriteContract({
    abi: interestRateModelAbi,
    functionName: 'setParams',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useWriteInterestRateModelTransferOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: interestRateModelAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link interestRateModelAbi}__
 */
export const useSimulateInterestRateModel =
  /*#__PURE__*/ createUseSimulateContract({ abi: interestRateModelAbi })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useSimulateInterestRateModelRenounceOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: interestRateModelAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"setParams"`
 */
export const useSimulateInterestRateModelSetParams =
  /*#__PURE__*/ createUseSimulateContract({
    abi: interestRateModelAbi,
    functionName: 'setParams',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link interestRateModelAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useSimulateInterestRateModelTransferOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: interestRateModelAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link interestRateModelAbi}__
 */
export const useWatchInterestRateModelEvent =
  /*#__PURE__*/ createUseWatchContractEvent({ abi: interestRateModelAbi })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link interestRateModelAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const useWatchInterestRateModelOwnershipTransferredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: interestRateModelAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link interestRateModelAbi}__ and `eventName` set to `"ParamsUpdated"`
 */
export const useWatchInterestRateModelParamsUpdatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: interestRateModelAbi,
    eventName: 'ParamsUpdated',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__
 */
export const useReadLenderVault = /*#__PURE__*/ createUseReadContract({
  abi: lenderVaultAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"allowance"`
 */
export const useReadLenderVaultAllowance = /*#__PURE__*/ createUseReadContract({
  abi: lenderVaultAbi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"asset"`
 */
export const useReadLenderVaultAsset = /*#__PURE__*/ createUseReadContract({
  abi: lenderVaultAbi,
  functionName: 'asset',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"balanceOf"`
 */
export const useReadLenderVaultBalanceOf = /*#__PURE__*/ createUseReadContract({
  abi: lenderVaultAbi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"convertToAssets"`
 */
export const useReadLenderVaultConvertToAssets =
  /*#__PURE__*/ createUseReadContract({
    abi: lenderVaultAbi,
    functionName: 'convertToAssets',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"convertToShares"`
 */
export const useReadLenderVaultConvertToShares =
  /*#__PURE__*/ createUseReadContract({
    abi: lenderVaultAbi,
    functionName: 'convertToShares',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"decimals"`
 */
export const useReadLenderVaultDecimals = /*#__PURE__*/ createUseReadContract({
  abi: lenderVaultAbi,
  functionName: 'decimals',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"market"`
 */
export const useReadLenderVaultMarket = /*#__PURE__*/ createUseReadContract({
  abi: lenderVaultAbi,
  functionName: 'market',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"maxDeposit"`
 */
export const useReadLenderVaultMaxDeposit = /*#__PURE__*/ createUseReadContract(
  { abi: lenderVaultAbi, functionName: 'maxDeposit' },
)

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"maxMint"`
 */
export const useReadLenderVaultMaxMint = /*#__PURE__*/ createUseReadContract({
  abi: lenderVaultAbi,
  functionName: 'maxMint',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"maxRedeem"`
 */
export const useReadLenderVaultMaxRedeem = /*#__PURE__*/ createUseReadContract({
  abi: lenderVaultAbi,
  functionName: 'maxRedeem',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"maxWithdraw"`
 */
export const useReadLenderVaultMaxWithdraw =
  /*#__PURE__*/ createUseReadContract({
    abi: lenderVaultAbi,
    functionName: 'maxWithdraw',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"name"`
 */
export const useReadLenderVaultName = /*#__PURE__*/ createUseReadContract({
  abi: lenderVaultAbi,
  functionName: 'name',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"owner"`
 */
export const useReadLenderVaultOwner = /*#__PURE__*/ createUseReadContract({
  abi: lenderVaultAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"previewDeposit"`
 */
export const useReadLenderVaultPreviewDeposit =
  /*#__PURE__*/ createUseReadContract({
    abi: lenderVaultAbi,
    functionName: 'previewDeposit',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"previewMint"`
 */
export const useReadLenderVaultPreviewMint =
  /*#__PURE__*/ createUseReadContract({
    abi: lenderVaultAbi,
    functionName: 'previewMint',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"previewRedeem"`
 */
export const useReadLenderVaultPreviewRedeem =
  /*#__PURE__*/ createUseReadContract({
    abi: lenderVaultAbi,
    functionName: 'previewRedeem',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"previewWithdraw"`
 */
export const useReadLenderVaultPreviewWithdraw =
  /*#__PURE__*/ createUseReadContract({
    abi: lenderVaultAbi,
    functionName: 'previewWithdraw',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"symbol"`
 */
export const useReadLenderVaultSymbol = /*#__PURE__*/ createUseReadContract({
  abi: lenderVaultAbi,
  functionName: 'symbol',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"totalAssets"`
 */
export const useReadLenderVaultTotalAssets =
  /*#__PURE__*/ createUseReadContract({
    abi: lenderVaultAbi,
    functionName: 'totalAssets',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"totalSupply"`
 */
export const useReadLenderVaultTotalSupply =
  /*#__PURE__*/ createUseReadContract({
    abi: lenderVaultAbi,
    functionName: 'totalSupply',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link lenderVaultAbi}__
 */
export const useWriteLenderVault = /*#__PURE__*/ createUseWriteContract({
  abi: lenderVaultAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"approve"`
 */
export const useWriteLenderVaultApprove = /*#__PURE__*/ createUseWriteContract({
  abi: lenderVaultAbi,
  functionName: 'approve',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"borrowCash"`
 */
export const useWriteLenderVaultBorrowCash =
  /*#__PURE__*/ createUseWriteContract({
    abi: lenderVaultAbi,
    functionName: 'borrowCash',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"deposit"`
 */
export const useWriteLenderVaultDeposit = /*#__PURE__*/ createUseWriteContract({
  abi: lenderVaultAbi,
  functionName: 'deposit',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"mint"`
 */
export const useWriteLenderVaultMint = /*#__PURE__*/ createUseWriteContract({
  abi: lenderVaultAbi,
  functionName: 'mint',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"redeem"`
 */
export const useWriteLenderVaultRedeem = /*#__PURE__*/ createUseWriteContract({
  abi: lenderVaultAbi,
  functionName: 'redeem',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useWriteLenderVaultRenounceOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: lenderVaultAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"setMarket"`
 */
export const useWriteLenderVaultSetMarket =
  /*#__PURE__*/ createUseWriteContract({
    abi: lenderVaultAbi,
    functionName: 'setMarket',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"transfer"`
 */
export const useWriteLenderVaultTransfer = /*#__PURE__*/ createUseWriteContract(
  { abi: lenderVaultAbi, functionName: 'transfer' },
)

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"transferFrom"`
 */
export const useWriteLenderVaultTransferFrom =
  /*#__PURE__*/ createUseWriteContract({
    abi: lenderVaultAbi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useWriteLenderVaultTransferOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: lenderVaultAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"withdraw"`
 */
export const useWriteLenderVaultWithdraw = /*#__PURE__*/ createUseWriteContract(
  { abi: lenderVaultAbi, functionName: 'withdraw' },
)

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link lenderVaultAbi}__
 */
export const useSimulateLenderVault = /*#__PURE__*/ createUseSimulateContract({
  abi: lenderVaultAbi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"approve"`
 */
export const useSimulateLenderVaultApprove =
  /*#__PURE__*/ createUseSimulateContract({
    abi: lenderVaultAbi,
    functionName: 'approve',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"borrowCash"`
 */
export const useSimulateLenderVaultBorrowCash =
  /*#__PURE__*/ createUseSimulateContract({
    abi: lenderVaultAbi,
    functionName: 'borrowCash',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"deposit"`
 */
export const useSimulateLenderVaultDeposit =
  /*#__PURE__*/ createUseSimulateContract({
    abi: lenderVaultAbi,
    functionName: 'deposit',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"mint"`
 */
export const useSimulateLenderVaultMint =
  /*#__PURE__*/ createUseSimulateContract({
    abi: lenderVaultAbi,
    functionName: 'mint',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"redeem"`
 */
export const useSimulateLenderVaultRedeem =
  /*#__PURE__*/ createUseSimulateContract({
    abi: lenderVaultAbi,
    functionName: 'redeem',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useSimulateLenderVaultRenounceOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: lenderVaultAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"setMarket"`
 */
export const useSimulateLenderVaultSetMarket =
  /*#__PURE__*/ createUseSimulateContract({
    abi: lenderVaultAbi,
    functionName: 'setMarket',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"transfer"`
 */
export const useSimulateLenderVaultTransfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: lenderVaultAbi,
    functionName: 'transfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"transferFrom"`
 */
export const useSimulateLenderVaultTransferFrom =
  /*#__PURE__*/ createUseSimulateContract({
    abi: lenderVaultAbi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useSimulateLenderVaultTransferOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: lenderVaultAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link lenderVaultAbi}__ and `functionName` set to `"withdraw"`
 */
export const useSimulateLenderVaultWithdraw =
  /*#__PURE__*/ createUseSimulateContract({
    abi: lenderVaultAbi,
    functionName: 'withdraw',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link lenderVaultAbi}__
 */
export const useWatchLenderVaultEvent =
  /*#__PURE__*/ createUseWatchContractEvent({ abi: lenderVaultAbi })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link lenderVaultAbi}__ and `eventName` set to `"Approval"`
 */
export const useWatchLenderVaultApprovalEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: lenderVaultAbi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link lenderVaultAbi}__ and `eventName` set to `"Deposit"`
 */
export const useWatchLenderVaultDepositEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: lenderVaultAbi,
    eventName: 'Deposit',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link lenderVaultAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const useWatchLenderVaultOwnershipTransferredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: lenderVaultAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link lenderVaultAbi}__ and `eventName` set to `"Transfer"`
 */
export const useWatchLenderVaultTransferEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: lenderVaultAbi,
    eventName: 'Transfer',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link lenderVaultAbi}__ and `eventName` set to `"Withdraw"`
 */
export const useWatchLenderVaultWithdrawEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: lenderVaultAbi,
    eventName: 'Withdraw',
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
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"borrowIndex"`
 */
export const useReadMarketBorrowIndex = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'borrowIndex',
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
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"currentDebt"`
 */
export const useReadMarketCurrentDebt = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'currentDebt',
})

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
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"getPosition"`
 */
export const useReadMarketGetPosition = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'getPosition',
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
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"interestRateModel"`
 */
export const useReadMarketInterestRateModel =
  /*#__PURE__*/ createUseReadContract({
    abi: marketAbi,
    functionName: 'interestRateModel',
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
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"lastAccrualTimestamp"`
 */
export const useReadMarketLastAccrualTimestamp =
  /*#__PURE__*/ createUseReadContract({
    abi: marketAbi,
    functionName: 'lastAccrualTimestamp',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"lenderVault"`
 */
export const useReadMarketLenderVault = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'lenderVault',
})

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
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"pendingBorrowsAndReserves"`
 */
export const useReadMarketPendingBorrowsAndReserves =
  /*#__PURE__*/ createUseReadContract({
    abi: marketAbi,
    functionName: 'pendingBorrowsAndReserves',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"positions"`
 */
export const useReadMarketPositions = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'positions',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"reserveFactor"`
 */
export const useReadMarketReserveFactor = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'reserveFactor',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"totalBorrows"`
 */
export const useReadMarketTotalBorrows = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'totalBorrows',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"totalCollateral"`
 */
export const useReadMarketTotalCollateral = /*#__PURE__*/ createUseReadContract(
  { abi: marketAbi, functionName: 'totalCollateral' },
)

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"totalReserves"`
 */
export const useReadMarketTotalReserves = /*#__PURE__*/ createUseReadContract({
  abi: marketAbi,
  functionName: 'totalReserves',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__
 */
export const useWriteMarket = /*#__PURE__*/ createUseWriteContract({
  abi: marketAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"accrueInterest"`
 */
export const useWriteMarketAccrueInterest =
  /*#__PURE__*/ createUseWriteContract({
    abi: marketAbi,
    functionName: 'accrueInterest',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"borrow"`
 */
export const useWriteMarketBorrow = /*#__PURE__*/ createUseWriteContract({
  abi: marketAbi,
  functionName: 'borrow',
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
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"setInterestRateModel"`
 */
export const useWriteMarketSetInterestRateModel =
  /*#__PURE__*/ createUseWriteContract({
    abi: marketAbi,
    functionName: 'setInterestRateModel',
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
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"setReserveFactor"`
 */
export const useWriteMarketSetReserveFactor =
  /*#__PURE__*/ createUseWriteContract({
    abi: marketAbi,
    functionName: 'setReserveFactor',
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
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"withdrawReserves"`
 */
export const useWriteMarketWithdrawReserves =
  /*#__PURE__*/ createUseWriteContract({
    abi: marketAbi,
    functionName: 'withdrawReserves',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__
 */
export const useSimulateMarket = /*#__PURE__*/ createUseSimulateContract({
  abi: marketAbi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"accrueInterest"`
 */
export const useSimulateMarketAccrueInterest =
  /*#__PURE__*/ createUseSimulateContract({
    abi: marketAbi,
    functionName: 'accrueInterest',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"borrow"`
 */
export const useSimulateMarketBorrow = /*#__PURE__*/ createUseSimulateContract({
  abi: marketAbi,
  functionName: 'borrow',
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
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"setInterestRateModel"`
 */
export const useSimulateMarketSetInterestRateModel =
  /*#__PURE__*/ createUseSimulateContract({
    abi: marketAbi,
    functionName: 'setInterestRateModel',
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
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"setReserveFactor"`
 */
export const useSimulateMarketSetReserveFactor =
  /*#__PURE__*/ createUseSimulateContract({
    abi: marketAbi,
    functionName: 'setReserveFactor',
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
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link marketAbi}__ and `functionName` set to `"withdrawReserves"`
 */
export const useSimulateMarketWithdrawReserves =
  /*#__PURE__*/ createUseSimulateContract({
    abi: marketAbi,
    functionName: 'withdrawReserves',
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
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__ and `eventName` set to `"InterestAccrued"`
 */
export const useWatchMarketInterestAccruedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: marketAbi,
    eventName: 'InterestAccrued',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__ and `eventName` set to `"InterestRateModelUpdated"`
 */
export const useWatchMarketInterestRateModelUpdatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: marketAbi,
    eventName: 'InterestRateModelUpdated',
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
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__ and `eventName` set to `"ReserveFactorUpdated"`
 */
export const useWatchMarketReserveFactorUpdatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: marketAbi,
    eventName: 'ReserveFactorUpdated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link marketAbi}__ and `eventName` set to `"ReservesWithdrawn"`
 */
export const useWatchMarketReservesWithdrawnEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: marketAbi,
    eventName: 'ReservesWithdrawn',
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

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link swapModuleAbi}__
 */
export const useReadSwapModule = /*#__PURE__*/ createUseReadContract({
  abi: swapModuleAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"MAX_FEE"`
 */
export const useReadSwapModuleMaxFee = /*#__PURE__*/ createUseReadContract({
  abi: swapModuleAbi,
  functionName: 'MAX_FEE',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"collateralDecimals"`
 */
export const useReadSwapModuleCollateralDecimals =
  /*#__PURE__*/ createUseReadContract({
    abi: swapModuleAbi,
    functionName: 'collateralDecimals',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"collateralToken"`
 */
export const useReadSwapModuleCollateralToken =
  /*#__PURE__*/ createUseReadContract({
    abi: swapModuleAbi,
    functionName: 'collateralToken',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"debtDecimals"`
 */
export const useReadSwapModuleDebtDecimals =
  /*#__PURE__*/ createUseReadContract({
    abi: swapModuleAbi,
    functionName: 'debtDecimals',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"debtToken"`
 */
export const useReadSwapModuleDebtToken = /*#__PURE__*/ createUseReadContract({
  abi: swapModuleAbi,
  functionName: 'debtToken',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"feeWad"`
 */
export const useReadSwapModuleFeeWad = /*#__PURE__*/ createUseReadContract({
  abi: swapModuleAbi,
  functionName: 'feeWad',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"haltController"`
 */
export const useReadSwapModuleHaltController =
  /*#__PURE__*/ createUseReadContract({
    abi: swapModuleAbi,
    functionName: 'haltController',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"oracle"`
 */
export const useReadSwapModuleOracle = /*#__PURE__*/ createUseReadContract({
  abi: swapModuleAbi,
  functionName: 'oracle',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"owner"`
 */
export const useReadSwapModuleOwner = /*#__PURE__*/ createUseReadContract({
  abi: swapModuleAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link swapModuleAbi}__
 */
export const useWriteSwapModule = /*#__PURE__*/ createUseWriteContract({
  abi: swapModuleAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useWriteSwapModuleRenounceOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: swapModuleAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"setFee"`
 */
export const useWriteSwapModuleSetFee = /*#__PURE__*/ createUseWriteContract({
  abi: swapModuleAbi,
  functionName: 'setFee',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"swapCollateralForDebt"`
 */
export const useWriteSwapModuleSwapCollateralForDebt =
  /*#__PURE__*/ createUseWriteContract({
    abi: swapModuleAbi,
    functionName: 'swapCollateralForDebt',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"swapDebtForCollateral"`
 */
export const useWriteSwapModuleSwapDebtForCollateral =
  /*#__PURE__*/ createUseWriteContract({
    abi: swapModuleAbi,
    functionName: 'swapDebtForCollateral',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useWriteSwapModuleTransferOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: swapModuleAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"withdrawInventory"`
 */
export const useWriteSwapModuleWithdrawInventory =
  /*#__PURE__*/ createUseWriteContract({
    abi: swapModuleAbi,
    functionName: 'withdrawInventory',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link swapModuleAbi}__
 */
export const useSimulateSwapModule = /*#__PURE__*/ createUseSimulateContract({
  abi: swapModuleAbi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useSimulateSwapModuleRenounceOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: swapModuleAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"setFee"`
 */
export const useSimulateSwapModuleSetFee =
  /*#__PURE__*/ createUseSimulateContract({
    abi: swapModuleAbi,
    functionName: 'setFee',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"swapCollateralForDebt"`
 */
export const useSimulateSwapModuleSwapCollateralForDebt =
  /*#__PURE__*/ createUseSimulateContract({
    abi: swapModuleAbi,
    functionName: 'swapCollateralForDebt',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"swapDebtForCollateral"`
 */
export const useSimulateSwapModuleSwapDebtForCollateral =
  /*#__PURE__*/ createUseSimulateContract({
    abi: swapModuleAbi,
    functionName: 'swapDebtForCollateral',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useSimulateSwapModuleTransferOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: swapModuleAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link swapModuleAbi}__ and `functionName` set to `"withdrawInventory"`
 */
export const useSimulateSwapModuleWithdrawInventory =
  /*#__PURE__*/ createUseSimulateContract({
    abi: swapModuleAbi,
    functionName: 'withdrawInventory',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link swapModuleAbi}__
 */
export const useWatchSwapModuleEvent =
  /*#__PURE__*/ createUseWatchContractEvent({ abi: swapModuleAbi })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link swapModuleAbi}__ and `eventName` set to `"FeeUpdated"`
 */
export const useWatchSwapModuleFeeUpdatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: swapModuleAbi,
    eventName: 'FeeUpdated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link swapModuleAbi}__ and `eventName` set to `"InventoryWithdrawn"`
 */
export const useWatchSwapModuleInventoryWithdrawnEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: swapModuleAbi,
    eventName: 'InventoryWithdrawn',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link swapModuleAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const useWatchSwapModuleOwnershipTransferredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: swapModuleAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link swapModuleAbi}__ and `eventName` set to `"Swapped"`
 */
export const useWatchSwapModuleSwappedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: swapModuleAbi,
    eventName: 'Swapped',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link wnvdAxFaucetAbi}__
 */
export const useReadWnvdAxFaucet = /*#__PURE__*/ createUseReadContract({
  abi: wnvdAxFaucetAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link wnvdAxFaucetAbi}__ and `functionName` set to `"CLAIM_AMOUNT"`
 */
export const useReadWnvdAxFaucetClaimAmount =
  /*#__PURE__*/ createUseReadContract({
    abi: wnvdAxFaucetAbi,
    functionName: 'CLAIM_AMOUNT',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link wnvdAxFaucetAbi}__ and `functionName` set to `"hasClaimed"`
 */
export const useReadWnvdAxFaucetHasClaimed =
  /*#__PURE__*/ createUseReadContract({
    abi: wnvdAxFaucetAbi,
    functionName: 'hasClaimed',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link wnvdAxFaucetAbi}__ and `functionName` set to `"token"`
 */
export const useReadWnvdAxFaucetToken = /*#__PURE__*/ createUseReadContract({
  abi: wnvdAxFaucetAbi,
  functionName: 'token',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link wnvdAxFaucetAbi}__
 */
export const useWriteWnvdAxFaucet = /*#__PURE__*/ createUseWriteContract({
  abi: wnvdAxFaucetAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link wnvdAxFaucetAbi}__ and `functionName` set to `"claim"`
 */
export const useWriteWnvdAxFaucetClaim = /*#__PURE__*/ createUseWriteContract({
  abi: wnvdAxFaucetAbi,
  functionName: 'claim',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link wnvdAxFaucetAbi}__
 */
export const useSimulateWnvdAxFaucet = /*#__PURE__*/ createUseSimulateContract({
  abi: wnvdAxFaucetAbi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link wnvdAxFaucetAbi}__ and `functionName` set to `"claim"`
 */
export const useSimulateWnvdAxFaucetClaim =
  /*#__PURE__*/ createUseSimulateContract({
    abi: wnvdAxFaucetAbi,
    functionName: 'claim',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link wnvdAxFaucetAbi}__
 */
export const useWatchWnvdAxFaucetEvent =
  /*#__PURE__*/ createUseWatchContractEvent({ abi: wnvdAxFaucetAbi })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link wnvdAxFaucetAbi}__ and `eventName` set to `"Claimed"`
 */
export const useWatchWnvdAxFaucetClaimedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: wnvdAxFaucetAbi,
    eventName: 'Claimed',
  })
