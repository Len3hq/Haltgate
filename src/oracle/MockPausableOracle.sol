// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPausableOracle} from "./IPausableOracle.sol";

/// @notice Test-only stand-in for Backed's confirmed xStocks oracle behavior:
/// pauseOracle() freezes price/updatedAt at their last known-good values during
/// a corporate action; setPrice() is blocked while paused, matching the real
/// mechanism's "no new prices published mid-CA" guarantee.
contract MockPausableOracle is IPausableOracle, Ownable {
    uint256 private _price;
    uint256 private _updatedAt;
    bool private _paused;

    error OraclePaused();
    error OracleNotPaused();

    event PricePaused(uint256 priceAtPause, uint256 updatedAt);
    event PriceResumed(uint256 newPrice, uint256 updatedAt);
    event PriceUpdated(uint256 newPrice, uint256 updatedAt);

    constructor(uint256 initialPrice, address owner_) Ownable(owner_) {
        _price = initialPrice;
        _updatedAt = block.timestamp;
    }

    function latestPrice() external view returns (uint256 price, uint256 updatedAt, bool paused) {
        return (_price, _updatedAt, _paused);
    }

    function isPaused() external view returns (bool) {
        return _paused;
    }

    /// @notice Freezes the feed at its current price, mirroring a corporate-action halt.
    function pauseOracle() external onlyOwner {
        if (_paused) revert OraclePaused();
        _paused = true;
        emit PricePaused(_price, _updatedAt);
    }

    /// @notice Resumes publishing, setting the post-CA price (e.g. post-split/dividend).
    function resumeOracle(uint256 newPrice) external onlyOwner {
        if (!_paused) revert OracleNotPaused();
        _paused = false;
        _price = newPrice;
        _updatedAt = block.timestamp;
        emit PriceResumed(newPrice, _updatedAt);
    }

    /// @notice Normal price update, only while OPEN — matches "no new prices while paused".
    function setPrice(uint256 newPrice) external onlyOwner {
        if (_paused) revert OraclePaused();
        _price = newPrice;
        _updatedAt = block.timestamp;
        emit PriceUpdated(newPrice, _updatedAt);
    }
}
