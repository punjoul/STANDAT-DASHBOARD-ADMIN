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

// Fetch Data (Versi Real-time Background)
async function fetchData() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        // Memisahkan header dan membalik baris agar data terbawah di database muncul teratas
        const orderHeaders = data.orders.shift();
        dbOrders = data.orders.reverse(); 
        
        const periodHeaders = data.periods.shift();
        dbPeriods = data.periods;

        // Cari periode aktif (Berdasarkan Kolom E status, Kolom A nama)
        const activeRow = dbPeriods.find(row => row[4] && row[4].toLowerCase() === 'active');
        if(activeRow) {
            activePeriodName = activeRow[0]; 
        }
        
        // Update dropdown tanpa mengganggu interaksi user
        populateDropdown();

        // Update tabel SECARA HALUS, hanya pada tab yang sedang terbuka
        if (document.getElementById('live-bet').classList.contains('active')) {
            renderLiveBet();
        } else if (document.getElementById('transaction-history').classList.contains('active')) {
            renderTransactionHistory();
        }
        
    } catch (error) {
        console.error("Error fetching data: ", error);
        document.getElementById('active-period-title').innerText = "Gagal memuat data. Sedang menyambungkan ulang...";
    }
}

// Render Live Bet
function renderLiveBet() {
    document.getElementById('active-period-title').innerText = `PERIOD: ${activePeriodName || 'Tidak ada periode aktif'}`;
    const tbody = document.querySelector('#table-live-bet tbody');
    tbody.innerHTML = '';

    // Filter order hanya untuk periode aktif
    const liveOrders = dbOrders.filter(row => row[1] === activePeriodName);
    
    liveOrders.forEach((row, index) => {
        // Pemetaan kolom: C(2)=Coupon, D(3)=Player, E(4)=Date, G(6)=Loc, H(7)=2D, I(8)=3D, J(9)=4D, L(11)=Total
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

// Populate Filter Dropdown (Anti-Flicker untuk Real-time)
function populateDropdown() {
    const select = document.getElementById('filter-period');
    
    // Kumpulkan nama periode yang unik dan hilangkan jika ada yang kosong
    const uniquePeriods = [...new Set(dbOrders.map(row => row[1]))].filter(p => p);
    
    // Cek jumlah opsi saat ini (dikurangi 1 karena ada opsi 'ALL')
    const currentOptionsCount = select.options.length - 1;
    
    // Hanya render ulang HTML dropdown JIKA ada periode baru
    // Ini mencegah dropdown menutup paksa jika Anda sedang mengkliknya saat auto-refresh berjalan
    if (uniquePeriods.length !== currentOptionsCount) {
        const currentFilter = select.value; // Simpan pilihan saat ini
        select.innerHTML = '<option value="ALL">All Periods</option>';
        
        uniquePeriods.forEach(p => {
            select.innerHTML += `<option value="${p}">${p}</option>`;
        });
        
        // Kembalikan ke pilihan user sebelumnya
        select.value = currentFilter; 
    }
}

// Convert string currency to number for Grand Total
function parseCurrency(val) {
    if(!val) return 0;
    let cleaned = val.toString().replace(/[^0-9.,]/g, "");
    
    if (cleaned.includes(',') && cleaned.includes('.')) {
        if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            cleaned = cleaned.replace(/,/g, '');
        }
    } else {
        cleaned = cleaned.replace(',', '.');
    }
    
    return parseFloat(cleaned) || 0;
}

// Render Transaction History
function renderTransactionHistory() {
    const tbody = document.querySelector('#table-transaction-history tbody');
    tbody.innerHTML = '';
    
    const filter = document.getElementById('filter-period').value;
    const limit = parseInt(document.getElementById('pagination-limit').value);
    
    // Filter by period
    let filteredOrders = filter === 'ALL' ? dbOrders : dbOrders.filter(row => row[1] === filter);
    
    // Memotong data sesuai jumlah limit pagination
    filteredOrders = filteredOrders.slice(0, limit);
    
    let grandTotal = 0;

    filteredOrders.forEach((row, index) => {
        // Pemetaan kolom: B(1)=Period, C(2)=Coupon, D(3)=Player, E(4)=Date, F(5)=Time, G(6)=Loc, H(7)=2D, I(8)=3D, J(9)=4D, L(11)=Total
        const locLink = `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row[6])}" target="_blank">${row[6]}</a>`;
        
        // Kalkulasi Grand Total (Hanya dari data yang tampil)
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

    // Update Grand Total
    document.getElementById('grand-total').innerText = '$' + grandTotal.toFixed(2).replace('.', ',');
}

// ========================================================
// INISIALISASI & REAL-TIME AUTO REFRESH (METODE POLLING)
// ========================================================

// 1. Tarik data pertama kali saat web dibuka
fetchData();

// 2. Tarik data secara otomatis setiap 15 detik (15000 milidetik)
// Angka 15 detik sangat aman untuk mencegah limit/kuota harian dari Google Apps Script
setInterval(fetchData, 15000);
