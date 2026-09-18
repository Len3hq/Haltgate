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
        RESUMING,
        SETTLING
    }

    /// @notice Bounds on settlementDelay, both load-bearing: the floor stops
    /// governance letting anyone stall an ordinary halt, the ceiling stops it
    /// restoring the indefinite lockup. Retunable, never revocable.
    uint256 public constant MIN_SETTLEMENT_DELAY = 1 days;
    uint256 public constant MAX_SETTLEMENT_DELAY = 30 days;

    IPausableOracle public immutable oracle;
    address public keeper;
    MarketState public state;

    /// @notice When the market last left OPEN, or zero while it is OPEN.
    uint256 public haltStartedAt;
    /// @notice How long the market may stay out of OPEN before anyone can
    /// force it into SETTLING.
    uint256 public settlementDelay;

    event StateChanged(MarketState indexed previous, MarketState indexed next);
    event ForceResumed(address indexed by, bytes32 reasonHash, string reason);
    event KeeperUpdated(address indexed previous, address indexed next);
    event Settled(address indexed by, uint256 haltStartedAt, uint256 settledAt);
    event SettlementDelayUpdated(uint256 previous, uint256 next);

    error NotAuthorized();
    error WrongState(MarketState required, MarketState actual);
    error ZeroAddress();
    error NotSettleable();
    error HaltTooRecent(uint256 settleableAt);
    error InvalidSettlementDelay();

    modifier onlyKeeperOrOwner() {
        if (msg.sender != keeper && msg.sender != owner()) revert NotAuthorized();
        _;
    }

    /// @dev keeper_/newKeeper reject the zero address deliberately -- not
    /// because a zero keeper would break anything (the owner can always act
    /// via onlyKeeperOrOwner regardless), but to prevent a silent, easy-to-miss
    /// misconfiguration. To deliberately run without a separate keeper, pass
    /// owner_'s own address instead of the zero address.
    constructor(address oracle_, address owner_, address keeper_) Ownable(owner_) {
        if (oracle_ == address(0) || keeper_ == address(0)) revert ZeroAddress();
        oracle = IPausableOracle(oracle_);
        keeper = keeper_;
        state = MarketState.OPEN;
        settlementDelay = 7 days; // a real corporate action settles in hours; a week means something has gone wrong
    }

    function setKeeper(address newKeeper) external onlyOwner {
        if (newKeeper == address(0)) revert ZeroAddress();
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }

    function setSettlementDelay(uint256 newDuration) external onlyOwner {
        if (newDuration < MIN_SETTLEMENT_DELAY || newDuration > MAX_SETTLEMENT_DELAY) revert InvalidSettlementDelay();
        emit SettlementDelayUpdated(settlementDelay, newDuration);
        settlementDelay = newDuration;
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

        if (oraclePaused) {
            // SETTLING is excluded: syncing it back would permissionlessly
            // re-trap the capital settlement just released.
            if (state != MarketState.HALTED && state != MarketState.SETTLING) {
                _setState(MarketState.HALTED);
            }
        } else if (state == MarketState.HALTED || state == MarketState.SETTLING) {
            _setState(MarketState.RESUMING); // settlement is a valve, not a dead end
        }
    }

    /// @notice Release valve: once the market has sat outside OPEN for longer
    /// than settlementDelay, anyone can move it to SETTLING, where lenders
    /// withdraw pro-rata (see LenderVault.maxRedeem). Permissionless because a
    /// guarantee gated on the governance that got the market stuck is no
    /// guarantee. Callable from HALTING/HALTED/RESUMING -- all three strand capital.
    function forceSettle() external {
        if (state == MarketState.OPEN || state == MarketState.SETTLING) revert NotSettleable();

        uint256 settleableAt = haltStartedAt + settlementDelay;
        if (block.timestamp < settleableAt) revert HaltTooRecent(settleableAt);

        _setState(MarketState.SETTLING);
        emit Settled(msg.sender, haltStartedAt, block.timestamp);
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

    function isSettling() external view returns (bool) {
        return state == MarketState.SETTLING;
    }

    /// @notice Debt stops growing while the price is unresolved and liquidation
    /// is off -- otherwise interest pushes borrowers toward a liquidation they
    /// can't defend against (BUILD.md §6 edge case 5).
    function interestFrozen() external view returns (bool) {
        return state == MarketState.HALTED || state == MarketState.SETTLING;
    }

    /// @return The timestamp forceSettle() becomes callable, or zero while
    /// the market is OPEN and no clock is running.
    function settlementAvailableAt() external view returns (uint256) {
        if (haltStartedAt == 0) return 0;
        return haltStartedAt + settlementDelay;
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
        if (next == MarketState.OPEN) {
            haltStartedAt = 0;
        } else if (haltStartedAt == 0) {
            // Set once on leaving OPEN, never restarted per phase -- it measures
            // how long capital has been restricted. Restarting would let a
            // market cycle between phases forever and never become settleable.
            haltStartedAt = block.timestamp;
        }
        emit StateChanged(state, next);
        state = next;
    }
}
