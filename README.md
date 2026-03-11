# DeFi Lending Protocol

A comprehensive, basic implementation of a DeFi Lending Protocol with similarities to architectures found in Aave and Compound.

## 🚀 Overview

The codebase implements a complete ecosystem facilitating lending and borrowing with algorithmic interest rates and a robust liquidation module:

1. **`LendingPool.sol`**: Central vault where users can supply tokens to earn yields or borrow tokens by supplying collateral. Includes logic ensuring that users don't break health factor boundaries natively on deposit/withdraw.
2. **`InterestRateModel.sol`**: Calculates borrow and supply yields based on the "Utilization Rate" of the pool (funds borrowed / total funds). Implements a double-slope model to incentivize supplying at a specific `kink` rate.
3. **`CollateralManager.sol`**: Evaluates LTV (Loan-To-Value) and Liquidation Thresholds securely combined with Oracle mocked prices.
4. **`Liquidation.sol`**: Handles underwater loans directly, allowing liquidators to clear bad debt and seize borrower's collateral with a $5\%$ premium.






https://github.com/user-attachments/assets/eebb8683-6fa6-4d65-a673-011391fe7463





   

## 🧮 Math Logic Used

- **Utilization Rate:** `(totalBorrowed * RAY) / totalLiquidity` — calculated in `1e27` formatting to preserve high precisions in decimal calculations (RAY Math).
- **Health Factor Calculation:** `(Collateral Value * Liquidation Threshold) / Borrow Value`. An account is strictly safe when this outputs `> 1.0` (scaled to `1e18`).
- **Target Seizing (Liquidation Bonus):** Values seized are strictly bound by `(collateralAmountUSD * 1.05) / underlyingAssetUSDPrice` to incentivize external arbitrators.

## 🛡️ Security Checks

- **Reentrancy Protection (`ReentrancyGuard`)**: Locks external state mutations preventing cross-contract callback hijacking upon transfer mechanisms.
- **Safe Transfers (`SafeERC20`)**: Standardized OpenZeppelin's implementations handle weird ERC20 compliances robustly directly on the vault.
- **Undercollateralized Gates**: Prevent withdrawing if the action diminishes health factor below liquidable levels using strict `require(...)` checks.

## ⚙️ Compilation
Since this project uses modern `@openzeppelin/contracts`, you can easily build by running:

```bash
npm install
npm run compile
```


