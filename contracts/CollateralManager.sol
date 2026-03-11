// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Collateral Manager
/// @notice Evaluates oracle pricing and collateral configurations
contract CollateralManager {
    // Math Logic Definitions
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Asset address => USD Price (scaled by 1e18)
    mapping(address => uint256) public assetPrices;
    
    // Ensures asset is whitelisted as collateral
    mapping(address => bool) public isSupportedCollateral;

    // Loan-To-Value (LTV) max permitted. E.g., 80% = 8000
    mapping(address => uint256) public collateralFactor;
    
    // When LTV hits this threshold, position gets liquidated. E.g., 85% = 8500
    mapping(address => uint256) public liquidationThreshold;

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "CollateralManager: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Configures oracle mock price for the asset
    function setAssetPrice(address asset, uint256 priceUSD) external onlyOwner {
        assetPrices[asset] = priceUSD;
    }

    /// @notice Configures risk parameters for an asset
    function configCollateral(address asset, uint256 _ltv, uint256 _liquidationThreshold) external onlyOwner {
        // Security Check: LTV must be less than or equal to Liquidation Threshold
        require(_ltv <= _liquidationThreshold, "CollateralManager: LTV > Threshold");
        isSupportedCollateral[asset] = true;
        collateralFactor[asset] = _ltv;
        liquidationThreshold[asset] = _liquidationThreshold;
    }

    /// @notice Calculates simple USD value
    function getCollateralValueInUSD(address asset, uint256 amount) public view returns (uint256) {
        uint256 price = assetPrices[asset];
        // Security Check: Ensures oracle has a valid price recorded
        require(price > 0, "CollateralManager: Oracle price missing"); 
        
        // Math logic: Both amount and price are 1e18, divide by 1e18 to prevent scale distortion
        return (amount * price) / 1e18; 
    }
}
