// GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const API_URL = 'https://script.google.com/macros/s/AKfycbwTWRORtstLpYkTxqVg_7a18XzVAJH865-PeO7B8V5K7X-z8LyJ6_Dn-zW9Z65HIlxo/exec';

let dbOrders = [];
let dbPeriods = [];
let activePeriodName = "";

// Realtime Clock
setInterval(() => {
    document.getElementById('clock').innerText = new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'medium' });
}, 1000);

// Tab Switcher
function switchTab(tabId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.getElementById('nav-' + tabId).classList.add('active');
    if(tabId === 'live-bet') renderLiveBet();
    if(tabId === 'transaction-history') renderTransactionHistory();
}

// Fetch Data
async function fetchData() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        // Memisahkan header dan membalik baris agar data terbawah di database muncul teratas[cite: 3, 4]
        const orderHeaders = data.orders.shift();
        dbOrders = data.orders.reverse(); 
        
        const periodHeaders = data.periods.shift();
        dbPeriods = data.periods;

        // Cari periode aktif (Berdasarkan Kolom E status, Kolom B nama)[cite: 3]
        const activeRow = dbPeriods.find(row => row[4] && row[4].toLowerCase() === 'active');
        if(activeRow) {
            activePeriodName = activeRow[1]; // Kolom B "period_name"
        }
        
        populateDropdown();
        renderLiveBet();
    } catch (error) {
        console.error("Error fetching data: ", error);
        document.getElementById('active-period-title').innerText = "Gagal memuat data.";
    }
}

// Render Live Bet
function renderLiveBet() {
    document.getElementById('active-period-title').innerText = `PERIOD: ${activePeriodName || 'Tidak ada periode aktif'}`;
    const tbody = document.querySelector('#table-live-bet tbody');
    tbody.innerHTML = '';

    // Filter order hanya untuk periode aktif[cite: 3]
    const liveOrders = dbOrders.filter(row => row[1] === activePeriodName);
    
    liveOrders.forEach((row, index) => {
        // Pemetaan kolom: C(2)=Coupon, D(3)=Player, E(4)=Date, G(6)=Loc, H(7)=2D, I(8)=3D, J(9)=4D, L(11)=Total[cite: 3]
        const locLink = `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row[6])}" target="_blank">${row[6]}</a>`;
        tbody.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${row[2]}</td>
                <td>${row[3]}</td>
                <td>${locLink}</td>
                <td>${row[4]}</td>
                <td>${row[7]}</td>
                <td>${row[8]}</td>
                <td>${row[9]}</td>
                <td>${row[11]}</td>
            </tr>
        `;
    });
}

// Populate Filter Dropdown
function populateDropdown() {
    const select = document.getElementById('filter-period');
    const uniquePeriods = [...new Set(dbOrders.map(row => row[1]))];
    uniquePeriods.forEach(p => {
        if(p) select.innerHTML += `<option value="${p}">${p}</option>`;
    });
}

// Convert string currency to number for Grand Total
function parseCurrency(val) {
    if(!val) return 0;
    return parseFloat(val.toString().replace(/[^0-9,-]+/g, "").replace(',', '.')) || 0;
}

// Render Transaction History
function renderTransactionHistory() {
    const tbody = document.querySelector('#table-transaction-history tbody');
    tbody.innerHTML = '';
    
    const filter = document.getElementById('filter-period').value;
    const limit = parseInt(document.getElementById('pagination-limit').value);
    
    // Filter by period[cite: 4]
    let filteredOrders = filter === 'ALL' ? dbOrders : dbOrders.filter(row => row[1] === filter);
    
    // Pagination limit[cite: 4]
    filteredOrders = filteredOrders.slice(0, limit);
    
    let grandTotal = 0;

    filteredOrders.forEach((row, index) => {
        // Pemetaan kolom: B(1)=Period, C(2)=Coupon, D(3)=Player, E(4)=Date, F(5)=Time, G(6)=Loc, H(7)=2D, I(8)=3D, J(9)=4D, L(11)=Total[cite: 4]
        const locLink = `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row[6])}" target="_blank">${row[6]}</a>`;
        grandTotal += parseCurrency(row[11]);

        tbody.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${row[1]}</td>
                <td>${row[2]}</td>
                <td>${row[3]}</td>
                <td>${locLink}</td>
                <td>${row[4]}</td>
                <td>${row[5]}</td>
                <td>${row[7]}</td>
                <td>${row[8]}</td>
                <td>${row[9]}</td>
                <td>${row[11]}</td>
            </tr>
        `;
    });

    // Update Grand Total (Format mata uang USD)[cite: 4]
    document.getElementById('grand-total').innerText = '$' + grandTotal.toFixed(2).replace('.', ',');
}

// Inisialisasi
fetchData();