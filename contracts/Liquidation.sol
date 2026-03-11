// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LendingPool.sol";
import "./CollateralManager.sol";

/// @title Liquidation Contract
/// @notice Handles liquidating undercollateralized positions to protect the protocol
contract Liquidation is ReentrancyGuard {
    using SafeERC20 for IERC20;

    LendingPool public lendingPool;
    CollateralManager public collateralManager;

    uint256 public constant LIQUIDATION_BONUS = 105; // Liquidator receives 5% premium
    uint256 public constant DENOMINATOR = 100;

    event Liquidated(address indexed liquidator, address indexed borrower, uint256 debtRepaid, uint256 collateralSeized);

    constructor(address _lendingPool, address _collateralManager) {
        lendingPool = LendingPool(_lendingPool);
        collateralManager = CollateralManager(_collateralManager);
    }

    /// @notice Liquidates an undercollateralized borrower
    /// @param borrower Account falling below health factor
    /// @param borrowAsset The asset they borrowed
    /// @param collateralAsset The asset the liquidator will seize
    /// @param debtToCover Amount of debt to repay
    function liquidate(
        address borrower,
        address borrowAsset,
        address collateralAsset,
        uint256 debtToCover
    ) external nonReentrant {
        // Security Check: Can only liquidate if health factor is < 1
        uint256 healthFactor = lendingPool.getHealthFactor(borrower, borrowAsset);
        require(healthFactor < 1e18, "Liquidation: Borrower is in good health");

        // Transfer debt asset from liquidator to the lending pool (repaying debt)
        IERC20(borrowAsset).safeTransferFrom(msg.sender, address(lendingPool), debtToCover);

        // Math Logic: Calculate collateral to seize with 5% liquidation bonus
        uint256 borrowAssetPriceInUSD = collateralManager.assetPrices(borrowAsset);
        uint256 collateralAssetPriceInUSD = collateralManager.assetPrices(collateralAsset);

        // Debt value in USD
        uint256 debtValueUSD = (debtToCover * borrowAssetPriceInUSD) / 1e18;
        
        // Asset value to seize (including bonus)
        uint256 valueToSeizeUSD = (debtValueUSD * LIQUIDATION_BONUS) / DENOMINATOR;
        
        // Convert USD value back to collateral asset amount
        uint256 collateralToSeize = (valueToSeizeUSD * 1e18) / collateralAssetPriceInUSD;

        // Security Check: Verify borrower has enough collateral to be seized
        require(lendingPool.userDeposits(borrower, collateralAsset) >= collateralToSeize, "Liquidation: Not enough collateral");

        // Clear debt and transfer collateral internal state
        lendingPool.clearBorrow(borrower, borrowAsset, debtToCover);
        lendingPool.seizeCollateral(borrower, msg.sender, collateralAsset, collateralToSeize);

        emit Liquidated(msg.sender, borrower, debtToCover, collateralToSeize);
    }
}
