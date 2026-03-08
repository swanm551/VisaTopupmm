// ══════════════════════════════════════════════════════
//  DOM Elements
// ══════════════════════════════════════════════════════
const body                    = document.body;
const icon                    = document.querySelector('.theme-toggle i');
const returnToTopBtn          = document.getElementById('return-to-top');
const rateTable               = document.getElementById('rateTable');
const updateTimeElement       = document.getElementById('updateTime');
const feeTablesDiv            = document.getElementById('feeTables');
const footer                  = document.querySelector('.footer');
const imageCopyrightContainer = document.getElementById('image-copyright-container');
const feeButtonsDiv           = document.querySelector('.fee-buttons');

let originalImageParent       = null;
let originalImageNextSibling  = null;

// ══════════════════════════════════════════════════════
//  Skeleton HTML
// ══════════════════════════════════════════════════════
const exchangeTableSkeleton = `
<table class="skeleton-table">
    <thead><tr>
        <th><span class="loading-skeleton"></span></th>
        <th><span class="loading-skeleton"></span></th>
        <th><span class="loading-skeleton"></span></th>
    </tr></thead>
    <tbody>
        ${Array(5).fill(`<tr>
            <td><span class="loading-skeleton"></span></td>
            <td><span class="loading-skeleton"></span></td>
            <td><span class="loading-skeleton"></span></td>
        </tr>`).join('')}
    </tbody>
</table>`;

// ══════════════════════════════════════════════════════
//  Theme Toggle
// ══════════════════════════════════════════════════════
function toggleTheme() {
    if (!body || !icon) return;
    const isDark = body.classList.contains('dark-theme');
    body.classList.toggle('dark-theme',  !isDark);
    body.classList.toggle('light-theme',  isDark);
    icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

// ══════════════════════════════════════════════════════
//  Scroll To Top
// ══════════════════════════════════════════════════════
if (returnToTopBtn) {
    window.onscroll = () => {
        returnToTopBtn.style.display =
            (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20)
                ? 'flex' : 'none';
    };
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

// ══════════════════════════════════════════════════════
//  Update Time
// ══════════════════════════════════════════════════════
function updateTime(timestamp = null) {
    if (!updateTimeElement) return;
    const d     = timestamp ? new Date(timestamp) : new Date();
    const day   = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'long' });
    const year  = d.getFullYear();
    let   hours = d.getHours();
    const mins  = d.getMinutes().toString().padStart(2, '0');
    const ampm  = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    updateTimeElement.textContent =
        `Exchange rate last updated: ${year} ${month} ${day}, ${hours}:${mins} ${ampm}`;
}

// ══════════════════════════════════════════════════════
//  Generic fetch with timeout + retry
// ══════════════════════════════════════════════════════
async function fetchWithRetry(url, timeout = 10000, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const ctrl = new AbortController();
            const tid  = setTimeout(() => ctrl.abort(), timeout);
            const res  = await fetch(url, { signal: ctrl.signal });
            clearTimeout(tid);
            if (!res.ok) throw new Error('Network response was not ok');
            return await res.text();
        } catch (err) {
            if (attempt === retries) throw err;
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
    }
}

// ══════════════════════════════════════════════════════
//  Exchange Rate Table
// ══════════════════════════════════════════════════════
function renderExchangeTable(rows) {
    if (!rateTable) return;
    let html = '<table><thead><tr>';
    rows[0].forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';
    for (let i = 1; i < rows.length; i++) {
        if (!rows[i].length || (rows[i].length === 1 && !rows[i][0].trim())) continue;
        html += '<tr>';
        rows[i].forEach((cell, idx) => {
            const v = cell.trim();
            let display = v;
            if (idx === 1 && !isNaN(v)) display = v + ' Ks';
            else if (idx > 0 && !isNaN(v)) display = parseInt(v).toLocaleString() + ' Ks';
            html += `<td>${display}</td>`;
        });
        html += '</tr>';
    }
    html += '</tbody></table>';
    rateTable.innerHTML = html;
}

const EXCHANGE_RATE_CACHE_KEY    = 'exchangeRatesCache';
const EXCHANGE_RATE_CACHE_EXPIRY = 60 * 1000;

async function fetchRates() {
    if (!rateTable || !updateTimeElement) return;
    const url = 'https://script.google.com/macros/s/AKfycbzh8uaqQeliA3ermIXm39XHnkXg5swV42dgb_Hoex-mTaTcdK3MeVPCwkoaBLxamCYl/exec';

    let renderedFromCache = false;
    const cached = localStorage.getItem(EXCHANGE_RATE_CACHE_KEY);
    if (cached) {
        try {
            const p = JSON.parse(cached);
            if (Date.now() - p.timestamp < EXCHANGE_RATE_CACHE_EXPIRY) {
                renderExchangeTable(p.data.split('\n').map(r => r.split(',')));
                updateTime(p.timestamp);
                renderedFromCache = true;
            }
        } catch { localStorage.removeItem(EXCHANGE_RATE_CACHE_KEY); }
    }

    if (!renderedFromCache) {
        rateTable.innerHTML = exchangeTableSkeleton;
        updateTimeElement.textContent = 'Loading exchange rates...';
    }

    try {
        const text = await fetchWithRetry(url, 10000, 1);
        const rows = text.split('\n').map(r => r.split(','));
        if (!rows.length || !rows[0].length) throw new Error('No data');
        const ts = Date.now();
        localStorage.setItem(EXCHANGE_RATE_CACHE_KEY, JSON.stringify({ data: text, timestamp: ts }));
        renderExchangeTable(rows);
        updateTime(ts);
    } catch (err) {
        console.error('Rates Fetch Error:', err);
        if (!renderedFromCache) {
            rateTable.innerHTML = err.name === 'AbortError'
                ? '<div class="error">Loading timeout❕ Please refresh.</div>'
                : '<div class="error">Failed to load rates 🥺. Please check your internet connection.</div>';
            updateTimeElement.textContent = 'Failed to load exchange rates.';
        }
    }
}

// ══════════════════════════════════════════════════════
//  Fee Table URLs
// ══════════════════════════════════════════════════════
const FEE_URLS = {
    uab:    'https://script.google.com/macros/s/AKfycbzh8uaqQeliA3ermIXm39XHnkXg5swV42dgb_Hoex-mTaTcdK3MeVPCwkoaBLxamCYl/exec?sheetName=uab',
    aya:    'https://script.google.com/macros/s/AKfycbzh8uaqQeliA3ermIXm39XHnkXg5swV42dgb_Hoex-mTaTcdK3MeVPCwkoaBLxamCYl/exec?sheetName=aya',
    cb:     'https://script.google.com/macros/s/AKfycbzh8uaqQeliA3ermIXm39XHnkXg5swV42dgb_Hoex-mTaTcdK3MeVPCwkoaBLxamCYl/exec?sheetName=cb',
    kbz:    'https://script.google.com/macros/s/AKfycbzh8uaqQeliA3ermIXm39XHnkXg5swV42dgb_Hoex-mTaTcdK3MeVPCwkoaBLxamCYl/exec?sheetName=kbz',
    mab:    'https://script.google.com/macros/s/AKfycbzh8uaqQeliA3ermIXm39XHnkXg5swV42dgb_Hoex-mTaTcdK3MeVPCwkoaBLxamCYl/exec?sheetName=mab',
    tiktok: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQMEfkm2e1w-xg5P-iQGJNjGCECWkHW-qHKr-tDfm971K70C8874Grf66mMHow0kOkyskk4EaXPCng_/pub?gid=1012771992&single=true&output=csv',
};

async function fetchFeeData(bank) {
    const cacheKey = `feeData-${bank}`;
    const cached   = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const p      = JSON.parse(cached);
            const expiry = bank === 'tiktok' ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000;
            if (Date.now() - p.timestamp < expiry) return p.data;
        } catch { localStorage.removeItem(cacheKey); }
    }

    try {
        const text = await fetchWithRetry(FEE_URLS[bank], 10000, 1);
        const rows = text.trim().split('\n').map(r => r.split(',').map(c => c.trim()));
        localStorage.setItem(cacheKey, JSON.stringify({ data: rows, timestamp: Date.now() }));
        return rows;
    } catch (err) {
        console.error(`Fee Fetch Error for ${bank}:`, err);
        return null;
    }
}

// ══════════════════════════════════════════════════════
//  Row Animations
// ══════════════════════════════════════════════════════
let currentFeeTableObserver = null;

function initializeTableRowAnimations() {
    if (currentFeeTableObserver) { currentFeeTableObserver.disconnect(); currentFeeTableObserver = null; }
    const feeTable = feeTablesDiv.querySelector('.fee-table');
    if (!feeTable) return;
    const rows = feeTable.querySelectorAll('tbody tr');
    currentFeeTableObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('fade-in-up'); obs.unobserve(e.target); }
        });
    }, { threshold: 0.1 });
    rows.forEach((row, i) => {
        row.style.transitionDelay = `${i * 0.01}s`;
        currentFeeTableObserver.observe(row);
    });
}

// ══════════════════════════════════════════════════════
//  Show / Hide Fee Table
// ══════════════════════════════════════════════════════
async function showFeeTable(bank) {
    if (!feeTablesDiv || !imageCopyrightContainer || !feeButtonsDiv) return;

    const existing     = document.getElementById(`fee-table-${bank}`);
    const imageInFeeDiv = feeTablesDiv.contains(imageCopyrightContainer);

    if (existing) {
        existing.style.opacity   = '0';
        existing.style.transform = 'translateY(20px)';
        if (currentFeeTableObserver) { currentFeeTableObserver.disconnect(); currentFeeTableObserver = null; }
        setTimeout(() => {
            existing.remove();
            feeTablesDiv.innerHTML = '';
            if (originalImageParent && imageCopyrightContainer)
                originalImageParent.insertBefore(imageCopyrightContainer, originalImageNextSibling);
        }, 500);
        return;
    }

    feeTablesDiv.innerHTML = '<div class="loading">Loading fee table...</div>';
    if (!imageInFeeDiv && imageCopyrightContainer?.parentNode)
        imageCopyrightContainer.remove();

    const rows = await fetchFeeData(bank);

    if (rows && rows.length >= 2) {
        let html = `<table class="fee-table" id="fee-table-${bank}"><thead><tr>`;
        rows[0].forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';
        for (let i = 1; i < rows.length; i++) {
            if (!rows[i].length || (rows[i].length === 1 && !rows[i][0])) continue;
            html += '<tr>';
            rows[i].forEach((cell, idx) => {
                const v       = cell.trim();
                const numOnly = v.replace(/[^0-9.]/g, '');
                let display   = v;
                if (idx > 0 && numOnly !== '' && !isNaN(numOnly))
                    display = parseInt(numOnly).toLocaleString() + ' Ks';
                html += `<td>${display}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody></table>';
        feeTablesDiv.innerHTML = html;
        initializeTableRowAnimations();
        if (imageCopyrightContainer) feeTablesDiv.appendChild(imageCopyrightContainer);
    } else {
        feeTablesDiv.innerHTML = '<div class="error">Failed to load fee table. Please try again later.</div>';
        if (imageCopyrightContainer && originalImageParent && !originalImageParent.contains(imageCopyrightContainer))
            originalImageParent.insertBefore(imageCopyrightContainer, originalImageNextSibling);
    }
}

// ══════════════════════════════════════════════════════
//  Preload bank fee data
// ══════════════════════════════════════════════════════
async function preloadFeeData() {
    for (const bank of ['uab', 'aya', 'cb', 'kbz', 'mab'])
        await fetchFeeData(bank);
}

// ══════════════════════════════════════════════════════
//  Service Worker
// ══════════════════════════════════════════════════════
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(r  => console.log('SW registered:', r.scope))
            .catch(e => console.error('SW failed:', e));
    }
}

// ══════════════════════════════════════════════════════
//  Init
// ══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    const theme = localStorage.getItem('theme') || 'dark';
    body.classList.toggle('light-theme', theme === 'light');
    body.classList.toggle('dark-theme',  theme !== 'light');
    icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';

    const copyEl = document.getElementById('copyright-text');
    if (copyEl) copyEl.textContent = `2019 - ${new Date().getFullYear()} copyright @Visa Topup Myanmar`;

    if (imageCopyrightContainer && feeButtonsDiv) {
        originalImageParent      = imageCopyrightContainer.parentNode;
        originalImageNextSibling = imageCopyrightContainer.nextSibling;
    }

    fetchRates();
    setInterval(fetchRates, 60 * 1000);
    preloadFeeData();
    registerServiceWorker();
});
