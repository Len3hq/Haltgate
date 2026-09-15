// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPausableOracle} from "./IPausableOracle.sol";

/// @notice Test-only stand-in for Backed's confirmed xStocks oracle behavior:
/// pauseOracle() freezes price/updatedAt at their last known-good values during
/// a corporate action; setPrice() is blocked while paused, matching the real
/// mechanism's "no new prices published mid-CA" guarantee.
///
/// Sanity bounds: no confirmed deviation-bound value exists for Backed's own
/// oracle (checked, not found), so this is HaltGate's own protocol-level
/// safety parameter, not a claimed mirror of an external spec. Deliberately
/// asymmetric: setPrice() (normal, non-CA updates) caps how far a single
/// update can move, since a large jump outside a corporate-action window is
/// suspicious. resumeOracle() (post-CA) has NO deviation cap -- a real split
/// or reverse split can legitimately move price by an arbitrary ratio, and
/// that's exactly the case this whole system exists to let through safely
/// once the halt window has done its job. Both still reject a zero price.
contract MockPausableOracle is IPausableOracle, Ownable {
    uint256 private _price;
    uint256 private _updatedAt;
    bool private _paused;

    /// @notice Max allowed deviation for a normal (non-CA) setPrice() update, in bps.
    uint256 public maxNormalUpdateDeviationBps;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    error OraclePaused();
    error OracleNotPaused();
    error ZeroPrice();
    error DeviationTooLarge(uint256 deviationBps, uint256 maxAllowedBps);

    event PricePaused(uint256 priceAtPause, uint256 updatedAt);
    event PriceResumed(uint256 newPrice, uint256 updatedAt);
    event PriceUpdated(uint256 newPrice, uint256 updatedAt);
    event MaxNormalUpdateDeviationUpdated(uint256 newDeviationBps);

    constructor(uint256 initialPrice, address owner_) Ownable(owner_) {
        if (initialPrice == 0) revert ZeroPrice();
        _price = initialPrice;
        _updatedAt = block.timestamp;
        maxNormalUpdateDeviationBps = 2000; // 20% default -- configurable, not a claimed real-world figure
    }

    function latestPrice() external view returns (uint256 price, uint256 updatedAt, bool paused) {
        return (_price, _updatedAt, _paused);
    }

    function isPaused() external view returns (bool) {
        return _paused;
    }

    function setMaxNormalUpdateDeviationBps(uint256 newDeviationBps) external onlyOwner {
        maxNormalUpdateDeviationBps = newDeviationBps;
        emit MaxNormalUpdateDeviationUpdated(newDeviationBps);
    }

    /// @notice Freezes the feed at its current price, mirroring a corporate-action halt.
    function pauseOracle() external onlyOwner {
        if (_paused) revert OraclePaused();
        _paused = true;
        emit PricePaused(_price, _updatedAt);
    }

    /// @notice Resumes publishing, setting the post-CA price (e.g. post-split/dividend).
    /// No deviation cap -- see contract-level note on why that's deliberate.
    function resumeOracle(uint256 newPrice) external onlyOwner {
        if (!_paused) revert OracleNotPaused();
        if (newPrice == 0) revert ZeroPrice();
        _paused = false;
        _price = newPrice;
        _updatedAt = block.timestamp;
        emit PriceResumed(newPrice, _updatedAt);
    }

    /// @notice Normal price update, only while OPEN, bounded to
    /// maxNormalUpdateDeviationBps from the current price.
    function setPrice(uint256 newPrice) external onlyOwner {
        if (_paused) revert OraclePaused();
        if (newPrice == 0) revert ZeroPrice();

        uint256 deviationBps = _deviationBps(_price, newPrice);
        if (deviationBps > maxNormalUpdateDeviationBps) {
            revert DeviationTooLarge(deviationBps, maxNormalUpdateDeviationBps);
        }

        _price = newPrice;
        _updatedAt = block.timestamp;
        emit PriceUpdated(newPrice, _updatedAt);
    }

    function _deviationBps(uint256 oldPrice, uint256 newPrice) internal pure returns (uint256) {
        uint256 diff = newPrice > oldPrice ? newPrice - oldPrice : oldPrice - newPrice;
        return (diff * BPS_DENOMINATOR) / oldPrice;
    }
}
