// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Price oracle that can be paused mid-corporate-action, mirroring
/// Backed's confirmed pauseOracle() behavior for xStocks: while paused, the
/// feed freezes at its last known good price rather than publishing a new one.
interface IPausableOracle {
    /// @return price The latest price, 18 decimals.
    /// @return updatedAt Timestamp of the last price update (frozen while paused).
    /// @return paused Whether the oracle is currently paused for a corporate action.
    function latestPrice() external view returns (uint256 price, uint256 updatedAt, bool paused);

    function isPaused() external view returns (bool);
}
