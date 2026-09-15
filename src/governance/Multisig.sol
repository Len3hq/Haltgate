// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Minimal N-of-M multisig. Confirmed Safe (Gnosis Safe) does not
/// support X Layer -- checked directly against Safe's official chain config
/// API (safe-config.safe.global), which lists 40 supported chains and
/// includes neither 196 (mainnet) nor 1952 (testnet). This is a
/// self-contained alternative, not a dependency on unsupported
/// third-party infrastructure.
///
/// Intended use: hold ownership of Market/HaltController/Oracle (directly,
/// or as the sole proposer behind a TimelockController for an added mandatory
/// delay -- see Governor.sol). Signer/threshold management is deliberately
/// gated behind the multisig's own execute() (target = address(this)), not a
/// separate admin key, so there is no single point of control anywhere in
/// the governance stack.
contract Multisig is ReentrancyGuard {
    struct Transaction {
        address target;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmations;
    }

    address[] public signers;
    mapping(address => bool) public isSigner;
    uint256 public threshold;

    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => bool)) public hasConfirmed;
    uint256 public transactionCount;

    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event ThresholdChanged(uint256 newThreshold);
    event TransactionProposed(
        uint256 indexed txId, address indexed proposer, address indexed target, uint256 value, bytes data
    );
    event TransactionConfirmed(uint256 indexed txId, address indexed signer);
    event TransactionRevoked(uint256 indexed txId, address indexed signer);
    event TransactionExecuted(uint256 indexed txId);

    error NotSigner();
    error ZeroAddress();
    error InvalidThreshold();
    error DuplicateSigner();
    error TxDoesNotExist();
    error AlreadyExecuted();
    error AlreadyConfirmed();
    error NotConfirmed();
    error InsufficientConfirmations();
    error ExecutionFailed(bytes returnData);
    error OnlySelf();

    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotSigner();
        _;
    }

    constructor(address[] memory signers_, uint256 threshold_) {
        if (threshold_ == 0 || threshold_ > signers_.length) revert InvalidThreshold();
        for (uint256 i = 0; i < signers_.length; i++) {
            address s = signers_[i];
            if (s == address(0)) revert ZeroAddress();
            if (isSigner[s]) revert DuplicateSigner();
            isSigner[s] = true;
            signers.push(s);
            emit SignerAdded(s);
        }
        threshold = threshold_;
        emit ThresholdChanged(threshold_);
    }

    /// @notice Proposes a new transaction and auto-confirms it from the proposer.
    function propose(address target, uint256 value, bytes calldata data) external onlySigner returns (uint256 txId) {
        if (target == address(0)) revert ZeroAddress();
        txId = transactionCount++;
        Transaction storage txn = transactions[txId];
        txn.target = target;
        txn.value = value;
        txn.data = data;
        emit TransactionProposed(txId, msg.sender, target, value, data);
        _confirm(txId);
    }

    function confirm(uint256 txId) external onlySigner {
        if (txId >= transactionCount) revert TxDoesNotExist();
        if (transactions[txId].executed) revert AlreadyExecuted();
        if (hasConfirmed[txId][msg.sender]) revert AlreadyConfirmed();
        _confirm(txId);
    }

    function _confirm(uint256 txId) internal {
        hasConfirmed[txId][msg.sender] = true;
        transactions[txId].confirmations++;
        emit TransactionConfirmed(txId, msg.sender);
    }

    function revokeConfirmation(uint256 txId) external onlySigner {
        if (txId >= transactionCount) revert TxDoesNotExist();
        if (transactions[txId].executed) revert AlreadyExecuted();
        if (!hasConfirmed[txId][msg.sender]) revert NotConfirmed();
        hasConfirmed[txId][msg.sender] = false;
        transactions[txId].confirmations--;
        emit TransactionRevoked(txId, msg.sender);
    }

    function execute(uint256 txId) external onlySigner nonReentrant {
        if (txId >= transactionCount) revert TxDoesNotExist();
        Transaction storage txn = transactions[txId];
        if (txn.executed) revert AlreadyExecuted();
        if (txn.confirmations < threshold) revert InsufficientConfirmations();

        txn.executed = true; // effects before interaction
        (bool success, bytes memory returnData) = txn.target.call{value: txn.value}(txn.data);
        if (!success) revert ExecutionFailed(returnData);
        emit TransactionExecuted(txId);
    }

    /// @notice Signer/threshold management must be proposed and confirmed
    /// through the multisig itself (target = address(this)) -- there is no
    /// separate admin key that can change who the signers are.
    function addSigner(address newSigner) external {
        if (msg.sender != address(this)) revert OnlySelf();
        if (newSigner == address(0)) revert ZeroAddress();
        if (isSigner[newSigner]) revert DuplicateSigner();
        isSigner[newSigner] = true;
        signers.push(newSigner);
        emit SignerAdded(newSigner);
    }

    function removeSigner(address signerToRemove) external {
        if (msg.sender != address(this)) revert OnlySelf();
        if (!isSigner[signerToRemove]) revert NotSigner();
        if (signers.length - 1 < threshold) revert InvalidThreshold();

        isSigner[signerToRemove] = false;
        uint256 len = signers.length;
        for (uint256 i = 0; i < len; i++) {
            if (signers[i] == signerToRemove) {
                signers[i] = signers[len - 1];
                signers.pop();
                break;
            }
        }
        emit SignerRemoved(signerToRemove);
    }

    function changeThreshold(uint256 newThreshold) external {
        if (msg.sender != address(this)) revert OnlySelf();
        if (newThreshold == 0 || newThreshold > signers.length) revert InvalidThreshold();
        threshold = newThreshold;
        emit ThresholdChanged(newThreshold);
    }

    function signerCount() external view returns (uint256) {
        return signers.length;
    }

    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    receive() external payable {}
}
