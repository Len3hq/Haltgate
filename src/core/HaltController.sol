// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPausableOracle} from "../oracle/IPausableOracle.sol";

/// @notice Tracks whether a HaltGate market is safe to operate on, gated by
/// the collateral's oracle-pause state (mirroring Backed's confirmed
/// pauseOracle() behavior) rather than balance-rebase detection, so it
/// correctly protects both raw and wrapped (non-rebasing) xStocks.
contract HaltController is Ownable {
    enum MarketState {
        OPEN,
        HALTING,
        HALTED,
        RESUMING
    }

    IPausableOracle public immutable oracle;
    address public keeper;
    MarketState public state;

    event StateChanged(MarketState indexed previous, MarketState indexed next);
    event ForceResumed(address indexed by, bytes32 reasonHash, string reason);
    event KeeperUpdated(address previous, address next);

    error NotAuthorized();
    error WrongState(MarketState required, MarketState actual);

    modifier onlyKeeperOrOwner() {
        if (msg.sender != keeper && msg.sender != owner()) revert NotAuthorized();
        _;
    }

    constructor(address oracle_, address owner_, address keeper_) Ownable(owner_) {
        oracle = IPausableOracle(oracle_);
        keeper = keeper_;
        state = MarketState.OPEN;
    }

    function setKeeper(address newKeeper) external onlyOwner {
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }

    /// @notice Pre-warn ahead of an expected oracle pause, per the known
    /// corporate-action timing schedule (confirmed: 00:30 UTC day after
    /// Ex-Date). Stops new risk-taking before the oracle actually freezes.
    function beginHalting() external onlyKeeperOrOwner {
        if (state != MarketState.OPEN) revert WrongState(MarketState.OPEN, state);
        _setState(MarketState.HALTING);
    }

    /// @notice Permissionless: syncs controller state with the oracle's
    /// actual pause status. This is the real trigger -- anyone can call it,
    /// so the market can never silently drift out of sync with the oracle.
    function sync() external {
        bool oraclePaused = oracle.isPaused();

        if (oraclePaused && state != MarketState.HALTED) {
            _setState(MarketState.HALTED);
        } else if (!oraclePaused && state == MarketState.HALTED) {
            _setState(MarketState.RESUMING);
        }
    }

    /// @notice Completes the resume once the Market has verified system-wide
    /// solvency (total collateral value >= total debt) post-CA.
    function completeResume() external onlyKeeperOrOwner {
        if (state != MarketState.RESUMING) revert WrongState(MarketState.RESUMING, state);
        _setState(MarketState.OPEN);
    }

    /// @notice Emergency escape hatch. Owner-only (not keeper), any state.
    function forceResume(string calldata reason) external onlyOwner {
        bytes32 reasonHash = keccak256(bytes(reason));
        _setState(MarketState.OPEN);
        emit ForceResumed(msg.sender, reasonHash, reason);
    }

    function isHalted() external view returns (bool) {
        return state == MarketState.HALTING || state == MarketState.HALTED;
    }

    function canSupplyOrBorrow() external view returns (bool) {
        return state == MarketState.OPEN;
    }

    function canLiquidate() external view returns (bool) {
        return state == MarketState.OPEN;
    }

    /// @notice Repay is always allowed -- it only ever reduces risk.
    function canRepay() external pure returns (bool) {
        return true;
    }

    function _setState(MarketState next) internal {
        emit StateChanged(state, next);
        state = next;
    }
}
