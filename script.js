const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx17A57khXP7ubD4xBlXoZ-EN1Wi2hUX5pVBxWu7tY25CQ6z_BXXLpgXOLk3hHM-UAnWw/exec';

let allOrdersData = [];
let activePeriodName = '';
let playersData = [];

// ==========================================
// INISIALISASI & JAM REAL-TIME
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    startClock();
    loadLiveBetAndHistory();
});

function startClock() {
    const clockEl = document.getElementById('clock');
    const update = () => {
        const now = new Date();
        clockEl.textContent = now.toLocaleString('id-ID', {
            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };
    update();
    setInterval(update, 1000);
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
        loadPeriodTable();
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
// MENU 2: PERIOD (Sheet PERIOD Kolom A - E)
// ==========================================
async function loadPeriodTable() {
    const tbody = document.querySelector('#table-period tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading data...</td></tr>';

    try {
        const res = await postToScript({ action: 'get_all_periods' });
        if (res.status !== 'success') {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;">${escapeHtml(res.message || 'Gagal memuat data')}</td></tr>`;
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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Terjadi kesalahan koneksi.</td></tr>';
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
    const dateVal = document.getElementById('input-period-date').value; // YYYY-MM-DD
    let startVal = document.getElementById('input-period-start').value; // HH:mm atau HH:mm:ss
    let endVal = document.getElementById('input-period-end').value;

    if (!dateVal) {
        document.getElementById('input-period-status').value = '';
        return;
    }

    if (startVal && startVal.length === 5) startVal += ':00';
    if (endVal && endVal.length === 5) endVal += ':00';

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    let status = 'inactive';
    if (dateVal > todayStr) {
        status = 'queue';
    } else if (dateVal < todayStr) {
        status = 'inactive';
    } else {
        // Tanggal sama dengan hari ini: cek rentang jam
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
            loadPeriodTable();
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
// MENU 3: REPORT (Agregasi Sheet ORDER)
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
