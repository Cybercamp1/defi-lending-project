// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Interest Rate Model (Double-slope)
/// @notice Implements standard DeFi interest rate logic, heavily inspired by Compound/Aave
contract InterestRateModel {
    uint256 public constant RAY = 1e27;
    uint256 public baseRate;
    uint256 public multiplier;
    uint256 public jumpMultiplier;
    uint256 public kink; // Optimal utilization rate threshold

    constructor(
        uint256 _baseRate,
        uint256 _multiplier,
        uint256 _jumpMultiplier,
        uint256 _kink
    ) {
        baseRate = _baseRate;
        multiplier = _multiplier;
        jumpMultiplier = _jumpMultiplier;
        kink = _kink;
    }

    /// @notice Evaluates dynamic borrow and supply rates based on pool liquidity usage
    function calculateInterestRates(
        uint256 totalBorrowed,
        uint256 totalLiquidity
    ) external view returns (uint256 borrowRate, uint256 supplyRate) {
        if (totalLiquidity == 0) {
            return (baseRate, 0);
        }

        // Math logic: Calculate Utilization Rate
        uint256 utilizationRate = (totalBorrowed * RAY) / totalLiquidity;

        // Math logic: Splitting Interest Rate Model based on kink threshold
        if (utilizationRate <= kink) {
            borrowRate = baseRate + ((utilizationRate * multiplier) / RAY);
        } else {
            uint256 normalRate = baseRate + ((kink * multiplier) / RAY);
            uint256 excessUtil = utilizationRate - kink;
            borrowRate = normalRate + ((excessUtil * jumpMultiplier) / RAY);
        }

        // Supply rate derivation based on fraction of borrowers paying interest
        supplyRate = (borrowRate * utilizationRate) / RAY;
    }
}
