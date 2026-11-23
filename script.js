const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx17A57khXP7ubD4xBlXoZ-EN1Wi2hUX5pVBxWu7tY25CQ6z_BXXLpgXOLk3hHM-UAnWw/exec';

let allOrdersData = [];
let activePeriodName = '';
let playersData = [];
let transactionsData = [];
let txCurrentPage = 1;

// ==========================================
// INISIALISASI, JAM GMT+9 & AUTO-REFRESH PERIOD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    startClock();
    loadLiveBetAndHistory();
    startPeriodAutoRefresh();
});

// Helper: Ambil tanggal & jam sekarang persis di GMT+9 (Timor Leste)
function getNowGMT9() {
    const gmt9 = new Date(Date.now() + 9 * 3600000);
    const yyyy = gmt9.getUTCFullYear();
    const mm = String(gmt9.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(gmt9.getUTCDate()).padStart(2, '0');
    const hh = String(gmt9.getUTCHours()).padStart(2, '0');
    const min = String(gmt9.getUTCMinutes()).padStart(2, '0');
    const ss = String(gmt9.getUTCSeconds()).padStart(2, '0');
    return {
        dateStr: `${yyyy}-${mm}-${dd}`,
        timeStr: `${hh}:${min}:${ss}`
    };
}

function startClock() {
    const clockEl = document.getElementById('clock');
    const update = () => {
        const now = new Date();
        clockEl.textContent = now.toLocaleString('id-ID', {
            timeZone: 'Asia/Dili',
            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }) + ' (GMT+9)';
    };
    update();
    setInterval(update, 1000);
}

// Refresh otomatis setiap 60 detik agar perubahan status Period langsung terlihat
function startPeriodAutoRefresh() {
    setInterval(() => {
        const periodPage = document.getElementById('period');
        const liveBetPage = document.getElementById('live-bet');

        if (periodPage && periodPage.classList.contains('active')) {
            loadPeriodTable(true);
        } else if (liveBetPage && liveBetPage.classList.contains('active')) {
            loadLiveBetAndHistory();
        }
    }, 60000);
}

// ==========================================
// NAVIGASI TAB
// ==========================================
function switchTab(tabId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav li').forEach(li => li.classList.remove('active'));

    const targetPage = document.getElementById(tabId);
    const targetNav = document.getElementById('nav-' + tabId);
    if (targetPage) targetPage.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    if (tabId === 'live-bet' || tabId === 'transaction-history') {
        loadLiveBetAndHistory();
    } else if (tabId === 'registration') {
        loadRegistrationTable();
    } else if (tabId === 'period') {
        loadPeriodTable(false);
    } else if (tabId === 'transaction') {
        loadTransactionTable();
    } else if (tabId === 'report') {
        loadReportTable();
    }
}

// Helper POST ke Google Apps Script
async function postToScript(paramsObj) {
    const body = new URLSearchParams(paramsObj);
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: body
    });
    return await response.json();
}

// Helper Link Google Maps untuk Kolom Location
function formatLocationLink(geo) {
    const cleanGeo = String(geo || '').trim();
    if (!cleanGeo || cleanGeo === '-') return '-';
    const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(cleanGeo)}`;
    return `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="attach-link">${escapeHtml(cleanGeo)}</a>`;
}

// ==========================================
// LIVE BET & TRANSACTION HISTORY
// ==========================================
async function loadLiveBetAndHistory() {
    try {
        const [periodRes, orderRes] = await Promise.all([
            postToScript({ action: 'get_period' }),
            postToScript({ action: 'get_admin_orders' })
        ]);

        if (periodRes.status === 'success' && periodRes.period) {
            activePeriodName = periodRes.period.name;
            document.getElementById('active-period-title').textContent =
                `PERIOD: ${periodRes.period.name} (${periodRes.period.date})`;
        } else {
            activePeriodName = '';
            document.getElementById('active-period-title').textContent = 'PERIOD: Tidak ada periode aktif';
        }

        if (orderRes.status === 'success') {
            allOrdersData = orderRes.data || [];
            populatePeriodFilter();
            renderLiveBet();
            renderTransactionHistory();
        }
    } catch (err) {
        console.error('Gagal memuat data order:', err);
    }
}

function renderLiveBet() {
    const tbody = document.querySelector('#table-live-bet tbody');
    const filtered = allOrdersData.filter(o => o.period_name === activePeriodName);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Belum ada taruhan pada periode aktif.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map((o, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(o.id_coupon)}</td>
            <td>${escapeHtml(o.id_player)}</td>
            <td>${formatLocationLink(o.geo_location)}</td>
            <td>${escapeHtml(o.date_order)}</td>
            <td>${escapeHtml(o.order_2d || '-')}</td>
            <td>${escapeHtml(o.order_3d || '-')}</td>
            <td>${escapeHtml(o.order_4d || '-')}</td>
            <td>$${Number(o.bet_amount).toFixed(2)}</td>
        </tr>
    `).join('');
}

function populatePeriodFilter() {
    const select = document.getElementById('filter-period');
    const currentVal = select.value;
    const uniquePeriods = [...new Set(allOrdersData.map(o => o.period_name))];

    select.innerHTML = '<option value="ALL">All Periods</option>' +
        uniquePeriods.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');

    if (uniquePeriods.includes(currentVal)) select.value = currentVal;
}

function renderTransactionHistory() {
    const tbody = document.querySelector('#table-transaction-history tbody');
    const periodFilter = document.getElementById('filter-period').value;
    const limit = parseInt(document.getElementById('pagination-limit').value, 10) || 10;

    let filtered = periodFilter === 'ALL'
        ? allOrdersData
        : allOrdersData.filter(o => o.period_name === periodFilter);

    const grandTotal = filtered.reduce((sum, o) => sum + Number(o.bet_amount || 0), 0);
    document.getElementById('grand-total').textContent = `$${grandTotal.toFixed(2)}`;

    const displayed = filtered.slice(0, limit);
    if (displayed.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">Tidak ada data transaksi.</td></tr>';
        return;
    }

    tbody.innerHTML = displayed.map((o, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(o.period_name)}</td>
            <td>${escapeHtml(o.id_coupon)}</td>
            <td>${escapeHtml(o.id_player)}</td>
            <td>${formatLocationLink(o.geo_location)}</td>
            <td>${escapeHtml(o.date_order)}</td>
            <td>${escapeHtml(o.time_order)}</td>
            <td>${escapeHtml(o.order_2d || '-')}</td>
            <td>${escapeHtml(o.order_3d || '-')}</td>
            <td>${escapeHtml(o.order_4d || '-')}</td>
            <td>$${Number(o.bet_amount).toFixed(2)}</td>
        </tr>
    `).join('');
}

// ==========================================
// MENU 1: REGISTRATION (Sheet PLAYER Kolom B - L)
// ==========================================
async function loadRegistrationTable() {
    const tbody = document.querySelector('#table-registration tbody');
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">Loading data...</td></tr>';

    try {
        const res = await postToScript({ action: 'get_players' });
        if (res.status !== 'success') {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:red;">${escapeHtml(res.message || 'Gagal memuat data')}</td></tr>`;
            return;
        }

        playersData = res.data || [];
        if (playersData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">Belum ada data pemain.</td></tr>';
            return;
        }

        tbody.innerHTML = playersData.map((p, idx) => `
            <tr class="clickable-row" onclick="openEditPlayerModal(${idx})">
                <td>${escapeHtml(p.name_of_player)}</td>
                <td>${escapeHtml(p.place_of_birth)}</td>
                <td>${escapeHtml(p.date_of_birth)}</td>
                <td>${escapeHtml(p.no_id_card)}</td>
                <td>${escapeHtml(p.address)}</td>
                <td>${escapeHtml(p.city_district)}</td>
                <td>${escapeHtml(p.phone_no)}</td>
                <td><span class="badge badge-level">${escapeHtml(p.player_level)}</span></td>
                <td><span class="badge badge-${p.player_status.toLowerCase()}">${escapeHtml(p.player_status)}</span></td>
                <td>${formatAttachmentLink(p.attachment1_player, 'Buka File 1')}</td>
                <td>${formatAttachmentLink(p.attachment2_player, 'Buka File 2')}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:red;">Terjadi kesalahan koneksi.</td></tr>';
        console.error(err);
    }
}

function formatAttachmentLink(url, label) {
    if (url && /^https?:\/\//i.test(url)) {
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="attach-link" onclick="event.stopPropagation()">${label}</a>`;
    }
    return `<span class="text-muted">${escapeHtml(url || '-')}</span>`;
}

function openEditPlayerModal(index) {
    const player = playersData[index];
    if (!player) return;

    document.getElementById('edit-id-player').value = player.id_player;
    document.getElementById('edit-name-player').value = player.name_of_player;
    document.getElementById('edit-player-level').value = player.player_level || 'Normal';
    document.getElementById('edit-player-status').value = player.player_status || 'Registered';

    document.getElementById('modal-edit-player').style.display = 'flex';
}

async function submitEditPlayer(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-save-player');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const res = await postToScript({
            action: 'update_player',
            id_player: document.getElementById('edit-id-player').value,
            player_level: document.getElementById('edit-player-level').value,
            player_status: document.getElementById('edit-player-status').value
        });

        if (res.status === 'success') {
            closeModal('modal-edit-player');
            loadRegistrationTable();
        } else {
            alert('Gagal menyimpan: ' + (res.message || 'Unknown error'));
        }
    } catch (err) {
        alert('Terjadi kesalahan saat menyimpan data.');
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
}

// ==========================================
// MENU 2: PERIOD (Sheet PERIOD Kolom A - E, Auto-Sync GMT+9)
// ==========================================
async function loadPeriodTable(silent = false) {
    const tbody = document.querySelector('#table-period tbody');
    if (!silent) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading data...</td></tr>';
    }

    try {
        const res = await postToScript({ action: 'get_all_periods' });
        if (res.status !== 'success') {
            if (!silent) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;">${escapeHtml(res.message || 'Gagal memuat data')}</td></tr>`;
            }
            return;
        }

        const periods = res.data || [];
        if (periods.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada data periode.</td></tr>';
            return;
        }

        tbody.innerHTML = periods.map(p => `
            <tr>
                <td>${escapeHtml(p.period_name)}</td>
                <td>${escapeHtml(p.period_date)}</td>
                <td>${escapeHtml(p.period_start)}</td>
                <td>${escapeHtml(p.period_end)}</td>
                <td><span class="badge badge-${p.period_status.toLowerCase()}">${escapeHtml(p.period_status)}</span></td>
            </tr>
        `).join('');
    } catch (err) {
        if (!silent) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Terjadi kesalahan koneksi.</td></tr>';
        }
        console.error(err);
    }
}

function openAddPeriodModal() {
    document.getElementById('form-add-period').reset();
    document.getElementById('input-period-start').value = '13:00:00';
    document.getElementById('input-period-end').value = '18:00:00';
    document.getElementById('input-period-status').value = '';
    document.getElementById('modal-add-period').style.display = 'flex';
}

function updateAutoPeriodStatus() {
    const dateVal = document.getElementById('input-period-date').value;
    let startVal = document.getElementById('input-period-start').value;
    let endVal = document.getElementById('input-period-end').value;

    if (!dateVal) {
        document.getElementById('input-period-status').value = '';
        return;
    }

    if (startVal && startVal.length === 5) startVal += ':00';
    if (endVal && endVal.length === 5) endVal += ':00';

    const { dateStr: todayStr, timeStr: nowTimeStr } = getNowGMT9();

    let status = 'inactive';
    if (dateVal > todayStr) {
        status = 'queue';
    } else if (dateVal < todayStr) {
        status = 'inactive';
    } else {
        if (startVal && nowTimeStr < startVal) {
            status = 'queue';
        } else if (startVal && endVal && nowTimeStr >= startVal && nowTimeStr <= endVal) {
            status = 'active';
        } else {
            status = 'inactive';
        }
    }

    document.getElementById('input-period-status').value = status;
}

async function submitAddPeriod(event) {
    event.preventDefault();
    updateAutoPeriodStatus();

    const btn = document.getElementById('btn-save-period');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const res = await postToScript({
            action: 'add_period',
            period_name: document.getElementById('input-period-name').value.trim(),
            period_date: document.getElementById('input-period-date').value,
            period_start: document.getElementById('input-period-start').value,
            period_end: document.getElementById('input-period-end').value,
            period_status: document.getElementById('input-period-status').value
        });

        if (res.status === 'success') {
            closeModal('modal-add-period');
            loadPeriodTable(false);
        } else {
            alert('Gagal menambah periode: ' + (res.message || 'Unknown error'));
        }
    } catch (err) {
        alert('Terjadi kesalahan saat menyimpan periode.');
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Period';
    }
}

// ==========================================
// MENU 3: TRANSACTION (Sheet ACTIVITY + PLAYER + ACCOUNT)
// ==========================================
async function loadTransactionTable() {
    const tbody = document.querySelector('#table-transaction tbody');
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Loading data...</td></tr>';

    try {
        const res = await postToScript({ action: 'get_transactions' });
        if (res.status !== 'success') {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:red;">${escapeHtml(res.message || 'Gagal memuat data transaksi')}</td></tr>`;
            return;
        }

        transactionsData = res.data || [];
        txCurrentPage = 1;
        renderTransactionTable();
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:red;">Terjadi kesalahan koneksi.</td></tr>';
        console.error(err);
    }
}

function onTxLimitChange() {
    txCurrentPage = 1;
    renderTransactionTable();
}

function changeTxPage(delta) {
    const limit = parseInt(document.getElementById('tx-pagination-limit').value, 10) || 10;
    const totalPages = Math.max(1, Math.ceil(transactionsData.length / limit));
    const nextPage = txCurrentPage + delta;
    if (nextPage >= 1 && nextPage <= totalPages) {
        txCurrentPage = nextPage;
        renderTransactionTable();
    }
}

function renderTransactionTable() {
    const tbody = document.querySelector('#table-transaction tbody');
    const limit = parseInt(document.getElementById('tx-pagination-limit').value, 10) || 10;
    const totalItems = transactionsData.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    if (txCurrentPage > totalPages) txCurrentPage = totalPages;
    if (txCurrentPage < 1) txCurrentPage = 1;

    const startIdx = (txCurrentPage - 1) * limit;
    const pageItems = transactionsData.slice(startIdx, startIdx + limit);

    document.getElementById('tx-page-info').textContent =
        `Page ${txCurrentPage} of ${totalPages} (Total: ${totalItems} data)`;
    document.getElementById('btn-tx-prev').disabled = txCurrentPage <= 1;
    document.getElementById('btn-tx-next').disabled = txCurrentPage >= totalPages;

    if (pageItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Belum ada data transaksi.</td></tr>';
        return;
    }

    tbody.innerHTML = pageItems.map((t, idx) => {
        const globalIdx = startIdx + idx;
        const statusLower = String(t.transaction_status || '').toLowerCase();
        return `
            <tr class="clickable-row" onclick="openEditTransactionModal(${globalIdx})">
                <td><span class="badge badge-${escapeHtml(statusLower)}">${escapeHtml(t.transaction_status)}</span></td>
                <td>${escapeHtml(t.id_player)}</td>
                <td>${escapeHtml(t.player_name)}</td>
                <td>${escapeHtml(t.date_transaction)}</td>
                <td>${escapeHtml(t.activity)}</td>
                <td>${escapeHtml(t.method)}</td>
                <td>$${Number(t.transaction_amount).toFixed(2)}</td>
                <td>${escapeHtml(t.bank_name || '-')}</td>
                <td>${escapeHtml(t.account_number || '-')}</td>
                <td>${escapeHtml(t.name_in_bank_account || '-')}</td>
            </tr>
        `;
    }).join('');
}

function openEditTransactionModal(globalIndex) {
    const tx = transactionsData[globalIndex];
    if (!tx) return;

    document.getElementById('tx-id-transaction').value = tx.id_transaction;
    document.getElementById('tx-row-index').value = tx.row_index;
    document.getElementById('tx-id-player').value = tx.id_player;
    document.getElementById('tx-player-name').value = tx.player_name;
    document.getElementById('tx-request-date').value = tx.date_transaction;
    document.getElementById('tx-activity').value = tx.activity;
    document.getElementById('tx-method').value = tx.method;
    document.getElementById('tx-amount').value = `$${Number(tx.transaction_amount).toFixed(2)}`;
    document.getElementById('tx-bank-name').value = tx.bank_name || '-';
    document.getElementById('tx-account-number').value = tx.account_number || '-';
    document.getElementById('tx-name-in-bank').value = tx.name_in_bank_account || '-';

    const currentStatus = String(tx.transaction_status || 'waiting').toLowerCase();
    document.getElementById('tx-status').value = currentStatus === 'approve' ? 'approve' : 'waiting';

    document.getElementById('modal-edit-transaction').style.display = 'flex';
}

async function submitEditTransaction(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-save-transaction');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    try {
        const res = await postToScript({
            action: 'update_transaction',
            id_transaction: document.getElementById('tx-id-transaction').value,
            row_index: document.getElementById('tx-row-index').value,
            transaction_status: document.getElementById('tx-status').value
        });

        if (res.status === 'success') {
            closeModal('modal-edit-transaction');
            loadTransactionTable();
        } else {
            alert('Gagal menyimpan: ' + (res.message || 'Unknown error'));
        }
    } catch (err) {
        alert('Terjadi kesalahan saat menyimpan transaksi.');
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.textContent = 'SIMPAN';
    }
}

// ==========================================
// MENU 4: REPORT (Agregasi Sheet ORDER)
// ==========================================
async function loadReportTable() {
    const tbody = document.querySelector('#table-report tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading data...</td></tr>';

    try {
        const res = await postToScript({ action: 'get_report' });
        if (res.status !== 'success') {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:red;">${escapeHtml(res.message || 'Gagal memuat report')}</td></tr>`;
            return;
        }

        const rows = res.data || [];
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Belum ada data order.</td></tr>';
            return;
        }

        let grand2d = 0, grand3d = 0, grand4d = 0, grandSales = 0, grandTax = 0;

        tbody.innerHTML = rows.map(r => {
            grand2d += r.total_2d;
            grand3d += r.total_3d;
            grand4d += r.total_4d;
            grandSales += r.total_sales;
            grandTax += r.tax_10;

            return `
                <tr>
                    <td>${escapeHtml(r.period_name)}</td>
                    <td>${escapeHtml(r.date_order)}</td>
                    <td>$${r.total_2d.toFixed(2)}</td>
                    <td>$${r.total_3d.toFixed(2)}</td>
                    <td>$${r.total_4d.toFixed(2)}</td>
                    <td><strong>$${r.total_sales.toFixed(2)}</strong></td>
                    <td>$${r.tax_10.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        document.getElementById('report-grand-2d').textContent = `$${grand2d.toFixed(2)}`;
        document.getElementById('report-grand-3d').textContent = `$${grand3d.toFixed(2)}`;
        document.getElementById('report-grand-4d').textContent = `$${grand4d.toFixed(2)}`;
        document.getElementById('report-grand-sales').textContent = `$${grandSales.toFixed(2)}`;
        document.getElementById('report-grand-tax').textContent = `$${grandTax.toFixed(2)}`;
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:red;">Terjadi kesalahan koneksi.</td></tr>';
        console.error(err);
    }
}

// ==========================================
// UTILITY MODAL & ESCAPE HTML
// ==========================================
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
