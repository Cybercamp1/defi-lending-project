// --- Mock Data & State ---
const ASSETS = {
    ETH: { symbol: 'ETH', icon: '💎', price: 3200, supplyApy: 3.5, borrowApy: 4.8, collatFactor: 0.8 },
    USDC: { symbol: 'USDC', icon: '💵', price: 1, supplyApy: 5.2, borrowApy: 6.5, collatFactor: 0.85 },
    WBTC: { symbol: 'WBTC', icon: '₿', price: 65000, supplyApy: 1.8, borrowApy: 3.2, collatFactor: 0.75 },
    LINK: { symbol: 'LINK', icon: '🔗', price: 18, supplyApy: 2.5, borrowApy: 5.0, collatFactor: 0.6 }
};

let userState = {
    connected: false,
    walletBalances: { ETH: 10.5, USDC: 50000, WBTC: 0.5, LINK: 1000 },
    supplies: { ETH: 0, USDC: 0, WBTC: 0, LINK: 0 },
    borrows: { ETH: 0, USDC: 0, WBTC: 0, LINK: 0 }
};

let modalState = {
    isOpen: false,
    action: '', // 'Supply', 'Withdraw', 'Borrow', 'Repay'
    asset: ''
};

// --- DOM Elements ---
const connectWalletBtn = document.getElementById('connectWalletBtn');
const netWorthDisplay = document.getElementById('netWorthDisplay');
const netApyDisplay = document.getElementById('netApyDisplay');
const healthFactorDisplay = document.getElementById('healthFactorDisplay');
const healthBarFill = document.getElementById('healthBarFill');

// Tables
const assetsToSupplyList = document.getElementById('assetsToSupplyList');
const userSuppliesList = document.getElementById('userSuppliesList');
const assetsToBorrowList = document.getElementById('assetsToBorrowList');
const userBorrowsList = document.getElementById('userBorrowsList');

const totalSuppliedBadge = document.getElementById('totalSuppliedBadge');
const totalBorrowedBadge = document.getElementById('totalBorrowedBadge');

// Modal
const modalOverlay = document.getElementById('actionModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalTitle = document.getElementById('modalTitle');
const modalAssetIcon = document.getElementById('modalAssetIcon');
const modalAssetName = document.getElementById('modalAssetName');
const modalAmountInput = document.getElementById('modalAmountInput');
const modalMaxBalance = document.getElementById('modalMaxBalance');
const modalActionBtn = document.getElementById('modalActionBtn');
const maxBtn = document.getElementById('maxBtn');
const modalNewHealth = document.getElementById('modalNewHealth');


// --- Initial Render ---
function init() {
    renderAssetsToSupply();
    renderAssetsToBorrow();
    updateDashboard();
}

function formatCurrency(val) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

// --- Logic Calculations ---
function calculateDashboardTotals() {
    let totalSupplyUSD = 0;
    let totalBorrowUSD = 0;
    let weightedSupplyApy = 0;
    let weightedBorrowApy = 0;
    let borrowingPower = 0;

    for (let target of Object.keys(ASSETS)) {
        let assetMsg = ASSETS[target];
        let suppValue = userState.supplies[target] * assetMsg.price;
        let borValue = userState.borrows[target] * assetMsg.price;

        totalSupplyUSD += suppValue;
        totalBorrowUSD += borValue;

        weightedSupplyApy += suppValue * assetMsg.supplyApy;
        weightedBorrowApy += borValue * assetMsg.borrowApy;

        borrowingPower += suppValue * assetMsg.collatFactor;
    }

    let netApy = 0;
    if (totalSupplyUSD > 0) {
        let avgSuppApy = weightedSupplyApy / totalSupplyUSD;
        let avgBorApy = totalBorrowUSD > 0 ? weightedBorrowApy / totalBorrowUSD : 0;
        netApy = avgSuppApy - (totalBorrowUSD / totalSupplyUSD) * avgBorApy;
    }

    let healthFactor = totalBorrowUSD === 0 ? Infinity : (borrowingPower / totalBorrowUSD);

    return { totalSupplyUSD, totalBorrowUSD, netApy, healthFactor };
}

function updateDashboard() {
    if (!userState.connected) {
        netWorthDisplay.innerText = "$0.00";
        netApyDisplay.innerText = "--";
        healthFactorDisplay.innerText = "∞";
        healthBarFill.style.width = "100%";
        healthBarFill.style.background = "var(--success)";
        return;
    }

    const totals = calculateDashboardTotals();
    const netWorth = totals.totalSupplyUSD - totals.totalBorrowUSD;

    netWorthDisplay.innerText = formatCurrency(netWorth);
    netApyDisplay.innerText = totals.totalSupplyUSD > 0 ? totals.netApy.toFixed(2) + '%' : '--';

    totalSuppliedBadge.innerText = `Balance: ${formatCurrency(totals.totalSupplyUSD)}`;
    totalBorrowedBadge.innerText = `Borrowed: ${formatCurrency(totals.totalBorrowUSD)}`;

    if (totals.healthFactor === Infinity) {
        healthFactorDisplay.innerText = "∞";
        healthFactorDisplay.className = "stat-value text-success";
        healthBarFill.style.width = "100%";
        healthBarFill.style.background = "var(--success)";
    } else {
        healthFactorDisplay.innerText = totals.healthFactor.toFixed(2);

        let perc = Math.min((totals.healthFactor / 3) * 100, 100);
        healthBarFill.style.width = `${perc}%`;

        if (totals.healthFactor > 2) {
            healthFactorDisplay.className = "stat-value text-success";
            healthBarFill.style.background = "var(--success)";
        } else if (totals.healthFactor > 1.2) {
            healthFactorDisplay.className = "stat-value text-warning";
            healthBarFill.style.background = "var(--warning)";
        } else {
            healthFactorDisplay.className = "stat-value text-danger";
            healthBarFill.style.background = "var(--danger)";
        }
    }
}

// --- Renders ---
function renderAssetsToSupply() {
    assetsToSupplyList.innerHTML = '';

    for (let sym of Object.keys(ASSETS)) {
        const asset = ASSETS[sym];
        const walletBal = userState.connected ? userState.walletBalances[sym] : 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="asset-cell">
                    <span class="asset-icon">${asset.icon}</span>
                    <span>${asset.symbol}</span>
                </div>
            </td>
            <td>${userState.connected ? walletBal.toFixed(4) : '--'}</td>
            <td class="text-success">${asset.supplyApy}%</td>
            <td>✓</td>
            <td style="text-align: right;">
                <button class="btn-outline" onclick="openModal('Supply', '${sym}')">Supply</button>
            </td>
        `;
        assetsToSupplyList.appendChild(tr);
    }
}

function renderUserSupplies() {
    userSuppliesList.innerHTML = '';
    let hasSupplies = false;

    for (let sym of Object.keys(userState.supplies)) {
        if (userState.supplies[sym] > 0) {
            hasSupplies = true;
            const asset = ASSETS[sym];
            const bal = userState.supplies[sym];
            const balUSD = bal * asset.price;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="asset-cell">
                        <span class="asset-icon">${asset.icon}</span>
                        <span>${asset.symbol}</span>
                    </div>
                </td>
                <td>
                    <div>${bal.toFixed(4)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${formatCurrency(balUSD)}</div>
                </td>
                <td class="text-success">${asset.supplyApy}%</td>
                <td>✓</td>
                <td style="text-align: right;">
                    <button class="btn-outline" onclick="openModal('Withdraw', '${sym}')">Withdraw</button>
                </td>
            `;
            userSuppliesList.appendChild(tr);
        }
    }

    if (!hasSupplies) {
        userSuppliesList.innerHTML = `<tr><td colspan="5" class="empty-state">Nothing supplied yet</td></tr>`;
    }
}

function renderAssetsToBorrow() {
    assetsToBorrowList.innerHTML = '';

    const totals = calculateDashboardTotals();
    const borrowingPowerUSD = Object.keys(userState.supplies).reduce((acc, sym) => {
        return acc + (userState.supplies[sym] * ASSETS[sym].price * ASSETS[sym].collatFactor);
    }, 0);

    const availableToBorrowUSD = Math.max(0, borrowingPowerUSD - totals.totalBorrowUSD);

    for (let sym of Object.keys(ASSETS)) {
        const asset = ASSETS[sym];
        let availableAmt = availableToBorrowUSD / asset.price;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="asset-cell">
                    <span class="asset-icon">${asset.icon}</span>
                    <span>${asset.symbol}</span>
                </div>
            </td>
            <td>${userState.connected ? availableAmt.toFixed(4) : '--'}</td>
            <td class="text-gradient">${asset.borrowApy}%</td>
            <td style="text-align: right;">
                <button class="btn-outline" onclick="openModal('Borrow', '${sym}')" ${(!userState.connected || availableAmt <= 0) ? 'disabled' : ''}>Borrow</button>
            </td>
        `;
        assetsToBorrowList.appendChild(tr);
    }
}

function renderUserBorrows() {
    userBorrowsList.innerHTML = '';
    let hasBorrows = false;

    for (let sym of Object.keys(userState.borrows)) {
        if (userState.borrows[sym] > 0) {
            hasBorrows = true;
            const asset = ASSETS[sym];
            const bal = userState.borrows[sym];
            const balUSD = bal * asset.price;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="asset-cell">
                        <span class="asset-icon">${asset.icon}</span>
                        <span>${asset.symbol}</span>
                    </div>
                </td>
                <td>
                    <div>${bal.toFixed(4)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${formatCurrency(balUSD)}</div>
                </td>
                <td class="text-gradient">${asset.borrowApy}%</td>
                <td style="text-align: right;">
                    <button class="btn-outline" onclick="openModal('Repay', '${sym}')">Repay</button>
                </td>
            `;
            userBorrowsList.appendChild(tr);
        }
    }

    if (!hasBorrows) {
        userBorrowsList.innerHTML = `<tr><td colspan="4" class="empty-state">Nothing borrowed yet</td></tr>`;
    }
}

// --- Connections ---
connectWalletBtn.addEventListener('click', () => {
    if (!userState.connected) {
        userState.connected = true;
        connectWalletBtn.innerText = '0x7b...3Fa9';
        connectWalletBtn.style.background = 'rgba(255,255,255,0.1)';
        connectWalletBtn.style.border = '1px solid var(--panel-border)';
        showToast('Wallet Connected Successfully!', 'success');

        renderAssetsToSupply();
        renderAssetsToBorrow();
        updateDashboard();
    }
});


// --- Modal Logic ---
window.openModal = function (action, assetSym) {
    if (!userState.connected) {
        showToast('Please connect wallet first', 'error');
        return;
    }

    modalState.action = action;
    modalState.asset = assetSym;

    const asset = ASSETS[assetSym];

    modalTitle.innerText = `${action} ${assetSym}`;
    modalAssetIcon.innerText = asset.icon;
    modalAssetName.innerText = assetSym;
    modalAmountInput.value = '';

    let maxBal = 0;
    if (action === 'Supply') maxBal = userState.walletBalances[assetSym];
    if (action === 'Withdraw') maxBal = userState.supplies[assetSym];
    if (action === 'Repay') maxBal = Math.min(userState.borrows[assetSym], userState.walletBalances[assetSym]);
    if (action === 'Borrow') {
        const totals = calculateDashboardTotals();
        const borrowingPowerUSD = Object.keys(userState.supplies).reduce((acc, sym) => {
            return acc + (userState.supplies[sym] * ASSETS[sym].price * ASSETS[sym].collatFactor);
        }, 0);
        const availableToBorrowUSD = Math.max(0, borrowingPowerUSD - totals.totalBorrowUSD);
        maxBal = availableToBorrowUSD / asset.price;
    }

    modalMaxBalance.innerText = maxBal.toFixed(4);
    modalActionBtn.innerText = action;

    // reset health 
    const currentTotals = calculateDashboardTotals();
    modalNewHealth.innerText = currentTotals.healthFactor === Infinity ? "∞" : currentTotals.healthFactor.toFixed(2);
    modalNewHealth.className = "text-success";

    modalOverlay.classList.remove('hidden');
};

closeModalBtn.addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
});

maxBtn.addEventListener('click', () => {
    modalAmountInput.value = modalMaxBalance.innerText;
    simulateHealthFactorChange();
});

modalAmountInput.addEventListener('input', simulateHealthFactorChange);

function simulateHealthFactorChange() {
    const amt = parseFloat(modalAmountInput.value) || 0;
    if (amt <= 0) return;

    // Deep copy user supplies/borrows to simulate
    let simSupplies = { ...userState.supplies };
    let simBorrows = { ...userState.borrows };

    if (modalState.action === 'Supply') simSupplies[modalState.asset] += amt;
    if (modalState.action === 'Withdraw') simSupplies[modalState.asset] = Math.max(0, simSupplies[modalState.asset] - amt);
    if (modalState.action === 'Borrow') simBorrows[modalState.asset] += amt;
    if (modalState.action === 'Repay') simBorrows[modalState.asset] = Math.max(0, simBorrows[modalState.asset] - amt);

    // Calc health
    let totalBorrowUSD = 0;
    let borrowingPower = 0;

    for (let sym of Object.keys(ASSETS)) {
        totalBorrowUSD += simBorrows[sym] * ASSETS[sym].price;
        borrowingPower += simSupplies[sym] * ASSETS[sym].price * ASSETS[sym].collatFactor;
    }

    let hf = totalBorrowUSD === 0 ? Infinity : (borrowingPower / totalBorrowUSD);

    modalNewHealth.innerText = hf === Infinity ? "∞" : hf.toFixed(2);
    if (hf > 2) modalNewHealth.className = "text-success";
    else if (hf > 1.2) modalNewHealth.className = "text-warning";
    else modalNewHealth.className = "text-danger";

    if (hf < 1 && modalState.action !== 'Repay' && modalState.action !== 'Supply') {
        modalNewHealth.innerText += " (Liquidatable)";
    }
}

modalActionBtn.addEventListener('click', () => {
    const amt = parseFloat(modalAmountInput.value);
    const maxBal = parseFloat(modalMaxBalance.innerText);

    if (isNaN(amt) || amt <= 0 || amt > maxBal) {
        showToast('Invalid amount', 'error');
        return;
    }

    // Process Actions
    if (modalState.action === 'Supply') {
        userState.walletBalances[modalState.asset] -= amt;
        userState.supplies[modalState.asset] += amt;
    }
    else if (modalState.action === 'Withdraw') {
        // Checking simulated HF
        let simSupplies = { ...userState.supplies };
        simSupplies[modalState.asset] -= amt;
        let bp = Object.keys(simSupplies).reduce((acc, sym) => acc + (simSupplies[sym] * ASSETS[sym].price * ASSETS[sym].collatFactor), 0);
        let totBor = Object.keys(userState.borrows).reduce((acc, sym) => acc + (userState.borrows[sym] * ASSETS[sym].price), 0);

        let hf = totBor === 0 ? Infinity : (bp / totBor);
        if (hf < 1) {
            showToast('Withdrawal rejected: Exceeds health factor', 'error');
            return;
        }

        userState.supplies[modalState.asset] -= amt;
        userState.walletBalances[modalState.asset] += amt;
    }
    else if (modalState.action === 'Borrow') {
        userState.walletBalances[modalState.asset] += amt;
        userState.borrows[modalState.asset] += amt;
    }
    else if (modalState.action === 'Repay') {
        userState.walletBalances[modalState.asset] -= amt;
        userState.borrows[modalState.asset] -= amt;
    }

    showToast(`${modalState.action} ${amt} ${modalState.asset} successful!`, 'success');

    // Update UI components
    modalOverlay.classList.add('hidden');
    renderAssetsToSupply();
    renderUserSupplies();
    renderAssetsToBorrow();
    renderUserBorrows();
    updateDashboard();
});

// --- Toast System ---
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }
    }, 4000);
}

// Start
init();
