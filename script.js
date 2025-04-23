// DOM Elements
const body = document.body;
const icon = document.querySelector('.theme-toggle i');
const returnToTopBtn = document.getElementById('return-to-top');
const rateTable = document.getElementById('rateTable');
const updateTimeElement = document.getElementById('updateTime');
const feeTablesDiv = document.getElementById('feeTables');
const footer = document.querySelector('.footer');

// Theme Toggle
function toggleTheme() {
    if (!body || !icon) return;

    const isDark = body.classList.contains('dark-theme');
    body.classList.toggle('dark-theme', !isDark);
    body.classList.toggle('light-theme', isDark);
    icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

// Scroll to Top
if (returnToTopBtn) {
    window.onscroll = () => {
        returnToTopBtn.style.display = (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) ? 'flex' : 'none';
    };
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update Time
function updateTime() {
    if (!updateTimeElement) return;

    const now = new Date();
    const day = now.getDate();
    const month = now.toLocaleString('en-US', { month: 'long' });
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    const formattedTime = `${hours}:${minutes} ${ampm}`;
    const formattedDate = `${year} ${month} ${day}`;
    updateTimeElement.textContent = `Exchange rate last updated: ${formattedDate}, ${formattedTime}`;
}

// Retry logic wrapper
async function fetchWithRetry(url, timeout = 10000, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('Network response was not ok');
            return await response.text();
        } catch (err) {
            if (attempt === retries) throw err;
        }
    }
}

// Fetch Exchange Rates
async function fetchRates() {
    if (!rateTable || !updateTimeElement) return;

    const url = 'https://script.google.com/macros/s/AKfycbzh8uaqQeliA3ermIXm39XHnkXg5swV42dgb_Hoex-mTaTcdK3MeVPCwkoaBLxamCYl/exec';
    rateTable.innerHTML = '<div class="loading">Loading rates...</div>';

    try {
        const data = await fetchWithRetry(url, 10000, 1);
        const rows = data.split('\n').map(row => row.split(','));
        if (rows.length === 0) throw new Error('No data');

      let html = '<table><thead><tr>';
rows[0].forEach(h => html += `<th>${h}</th>`);
html += '</tr></thead><tbody>';
for (let i = 1; i < rows.length; i++) {
    html += '<tr>';
    rows[i].forEach((cell, idx) => {
        const value = cell.trim();
        html += `<td>${idx > 0 && !isNaN(value) ? parseInt(value) + ' Ks' : value}</td>`;
    });
    html += '</tr>';
}
html += '</tbody></table>';

rateTable.innerHTML = html;
        updateTime();
    } catch (error) {
        console.error('Rates Fetch Error:', error);
        rateTable.innerHTML = error.name === 'AbortError'
            ? '<div class="error">Loading timeout❕ Please refresh.</div>'
            : '<div class="error">Failed to load rates 🥺 .</div>';
    }
}

// Fetch Fee Table
let feeDataCache = {};

async function fetchFeeData(bank) {
    const cacheKey = `feeData-${bank}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) return parsed.data;
    }

    const urls = {
        uab: '...sheetName=uab',
        aya: '...sheetName=aya',
        cb: '...sheetName=cb',
        kbz: '...sheetName=kbz',
        mab: '...sheetName=mab'
    };

    try {
        const data = await fetchWithRetry(urls[bank], 10000, 1);
        const rows = data.split('\n').map(r => r.split(','));
        localStorage.setItem(cacheKey, JSON.stringify({ data: rows, timestamp: Date.now() }));
        return rows;
    } catch (error) {
        console.error('Fee Fetch Error:', error);
        return null;
    }
}

async function showFeeTable(bank) {
    if (!feeTablesDiv) return;

    const existing = document.getElementById(`fee-table-${bank}`);
    if (existing) return existing.remove();

    feeTablesDiv.innerHTML = '<div class="loading">Loading fee table...</div>';
    const rows = await fetchFeeData(bank);

    if (rows) {
        let html = `<table class="fee-table" id="fee-table-${bank}"><thead><tr>`;
        rows[0].forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';
        for (let i = 1; i < rows.length; i++) {
            html += '<tr>';
            rows[i].forEach((cell, idx) => {
                const value = cell.trim();
                html += `<td>${idx > 0 && !isNaN(value) ? parseInt(value).toLocaleString() + ' Ks' : value}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody></table>';
        feeTablesDiv.innerHTML = html;
    } else {
        feeTablesDiv.innerHTML = '<div class="error">Failed to load fee table.</div>';
    }
}

// Preload Fee Tables
async function preloadFeeData() {
    const banks = ['uab', 'aya', 'cb', 'kbz', 'mab'];
    for (const bank of banks) {
        await fetchFeeData(bank);
    }
}

// Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                console.log('SW registered:', reg.scope);
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data.type === 'DATA_UPDATED') {
                        const { sheetType } = event.data;
                        if (sheetType === currentActiveTab) fetchData(sheetType);
                    }
                });
            })
            .catch(err => console.error('SW failed:', err));
    }
}

// Fetch Data (optional for multi-sheet tabs)
async function fetchData(sheetType) {
    const url = `https://.../exec?sheetName=${sheetType}`;
    try {
        const cache = await caches.open('visa-topup-cache-v3');
        const cached = await cache.match(url);
        if (cached) renderTable(await cached.text(), sheetType);

        const netRes = await fetchWithRetry(`${url}&t=${Date.now()}`, 10000, 1);
        renderTable(netRes, sheetType);
        await cache.put(url, new Response(netRes));

        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'UPDATE_SHEET',
                sheetType,
                data: netRes
            });
        }
    } catch (err) {
        console.error(`Fetch ${sheetType} Error:`, err);
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    const theme = localStorage.getItem('theme') || 'dark';
    body.classList.toggle('light-theme', theme === 'light');
    body.classList.toggle('dark-theme', theme !== 'light');
    icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';

    fetchRates();
    setInterval(fetchRates, 60000); // every 1 minute
    preloadFeeData();
    registerServiceWorker();

    // Footer scroll animation
    if (footer) {
        let lastScrollTop = 0;
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            footer.style.bottom = scrollTop > lastScrollTop ? '-100px' : '0';
            lastScrollTop = Math.max(scrollTop, 0);
        });
    }
});
