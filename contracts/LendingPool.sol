// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./InterestRateModel.sol";
import "./CollateralManager.sol";

/// @title Lending Pool Contract
/// @dev Manages the primary interactions: Deposit, Borrow, Repay, Withdraw
contract LendingPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    InterestRateModel public interestRateModel;
    CollateralManager public collateralManager;

    mapping(address => mapping(address => uint256)) public userDeposits;
    mapping(address => mapping(address => uint256)) public userBorrows;
    
    mapping(address => uint256) public totalDeposits;
    mapping(address => uint256) public totalBorrows;

    address public owner;
    address public liquidationContract;

    event Deposited(address indexed user, address indexed asset, uint256 amount);
    event Withdrawn(address indexed user, address indexed asset, uint256 amount);
    event Borrowed(address indexed user, address indexed asset, uint256 amount);
    event Repaid(address indexed user, address indexed asset, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "LendingPool: caller is not the owner");
        _;
    }

    constructor(address _interestRateModel, address _collateralManager) {
        owner = msg.sender;
        interestRateModel = InterestRateModel(_interestRateModel);
        collateralManager = CollateralManager(_collateralManager);
    }

    function setLiquidationContract(address _liquidationContract) external onlyOwner {
        liquidationContract = _liquidationContract;
    }

    /// @notice Supply asset to the lending pool
    function deposit(address asset, uint256 amount) external nonReentrant {
        require(amount > 0, "LendingPool: Amount must be > 0");
        require(collateralManager.isSupportedCollateral(asset), "LendingPool: Asset not supported");

        // Transfer funds from user (SafeERC20 security)
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        userDeposits[msg.sender][asset] += amount;
        totalDeposits[asset] += amount;

        emit Deposited(msg.sender, asset, amount);
    }

    /// @notice Withdraw supplied assets
    function withdraw(address asset, uint256 amount) external nonReentrant {
        require(amount > 0, "LendingPool: Amount must be > 0");
        require(userDeposits[msg.sender][asset] >= amount, "LendingPool: Insufficient balance");

        // Temporarily reduce balance to evaluate post-operation health factor
        userDeposits[msg.sender][asset] -= amount;
        totalDeposits[asset] -= amount;

        // Security Check: Ensure user does not fall below collateral requirements
        require(getHealthFactor(msg.sender, asset) >= 1e18, "LendingPool: Health factor falls below 1");

        // Transfer funds
        IERC20(asset).safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, asset, amount);
    }

    /// @notice Borrow an asset against collateral
    function borrow(address asset, uint256 amount) external nonReentrant {
        require(amount > 0, "LendingPool: Amount must be > 0");
        require(totalDeposits[asset] - totalBorrows[asset] >= amount, "LendingPool: Insufficient liquidity");

        // Temporary increase of borrows to evaluate post-operation health factor
        userBorrows[msg.sender][asset] += amount;
        totalBorrows[asset] += amount;

        // Security Check: Ensure user holds sufficient collateral
        require(getHealthFactor(msg.sender, asset) >= 1e18, "LendingPool: Undercollateralized borrow");

        IERC20(asset).safeTransfer(msg.sender, amount);

        emit Borrowed(msg.sender, asset, amount);
    }

    /// @notice Repay a borrowed loan
    function repay(address asset, uint256 amount) external nonReentrant {
        require(amount > 0, "LendingPool: Amount must be > 0");
        require(userBorrows[msg.sender][asset] >= amount, "LendingPool: Repayment exceeds borrow balance");

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        userBorrows[msg.sender][asset] -= amount;
        totalBorrows[asset] -= amount;

        emit Repaid(msg.sender, asset, amount);
    }
    
    // ----- Liquidation Privileged Functions -----

    function clearBorrow(address user, address borrowAsset, uint256 amount) external {
        require(msg.sender == liquidationContract, "LendingPool: Unauthorized");
        userBorrows[user][borrowAsset] -= amount;
        totalBorrows[borrowAsset] -= amount;
    }

    function seizeCollateral(address user, address liquidator, address collateralAsset, uint256 amount) external {
        require(msg.sender == liquidationContract, "LendingPool: Unauthorized");
        userDeposits[user][collateralAsset] -= amount;
        userDeposits[liquidator][collateralAsset] += amount;
    }

    // ----- Public Getters & Math Logic -----

    /// @notice Calculate the user's Health Factor
    function getHealthFactor(address user, address borrowAsset) public view returns (uint256) {
        // Simplified approach: Evaluating health on single asset interaction.
        // Full production versions trace over an array of all reserved assets.
        uint256 totalCollateralValueUSD = collateralManager.getCollateralValueInUSD(borrowAsset, userDeposits[user][borrowAsset]);
        uint256 totalBorrowValueUSD = collateralManager.getCollateralValueInUSD(borrowAsset, userBorrows[user][borrowAsset]);

        if (totalBorrowValueUSD == 0) return type(uint256).max; // Infinite health

        uint256 avgLiquidationThreshold = collateralManager.liquidationThreshold(borrowAsset);
        
        // Math Logic: (Collateral Value * Liquidation Threshold) / Borrow Value
        uint256 collateralThresholdValue = (totalCollateralValueUSD * avgLiquidationThreshold) / collateralManager.BPS_DENOMINATOR();
        return (collateralThresholdValue * 1e18) / totalBorrowValueUSD;
    }

    /// @notice Determine current pool rates
    function getRates(address asset) external view returns (uint256 borrowRate, uint256 supplyRate) {
        return interestRateModel.calculateInterestRates(totalBorrows[asset], totalDeposits[asset]);
    }
}
