// DOM Elements
const body = document.body;
const icon = document.querySelector('.theme-toggle i');
const returnToTopBtn = document.getElementById('return-to-top');
const rateTable = document.getElementById('rateTable');
const updateTimeElement = document.getElementById('updateTime');
const feeTablesDiv = document.getElementById('feeTables');
const footer = document.querySelector('.footer');

// Theme Toggle Function
function toggleTheme() {
    if (!body || !icon) return;
    
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
        icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    }
}

// Scroll to Top Functionality
if (returnToTopBtn) {
    window.onscroll = function() {
        if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
            returnToTopBtn.style.display = 'flex';
        } else {
            returnToTopBtn.style.display = 'none';
        }
    };
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Exchange Rates Functions
async function fetchRates() {
    if (!rateTable || !updateTimeElement) return;
    
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNDdKNRmuS_lu66UUjPilT7lUNXogFk3ByljcyJHDRIUoPh5Lk_PCQ0dp7I5Td-YL55KWe1_WCeku5/pub?output=csv&gid=0';
    
    try {
        rateTable.innerHTML = '<div class="loading">Loading rates...</div>';
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.text();
        const rows = data.split('\n').map(row => row.split(','));
        
        if (rows.length === 0) throw new Error('No data received');
        
        let tableHTML = '<table><thead><tr>';
        rows[0].forEach(header => {
            tableHTML += `<th>${header}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';
        
        for (let i = 1; i < rows.length; i++) {
            tableHTML += '<tr>';
            rows[i].forEach((cell, index) => {
                const cellValue = cell.trim();
                tableHTML += `<td>${index > 0 && !isNaN(cellValue) ? parseInt(cellValue) + ' Ks' : cellValue}</td>`;
            });
            tableHTML += '</tr>';
        }
        tableHTML += '</tbody></table>';
        
        rateTable.innerHTML = tableHTML;
        updateTime();
    } catch (error) {
        console.error('Error:', error);
        rateTable.innerHTML = error.name === 'AbortError'
            ? '<div class="error">Loading timeout. Please refresh.</div>'
            : '<div class="error">Failed to load rates.</div>';
    }
}

function updateTime() {
    if (!updateTimeElement) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    const dateString = now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    });
    updateTimeElement.textContent = `Exchange rate updated on: ${timeString}, ${dateString}`;
}

// Fee Table Functions
let feeDataCache = {};

async function fetchFeeData(bank) {
    const cacheKey = `feeData-${bank}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        const now = Date.now();
        const cacheExpiryTime = 60 * 60 * 1000; // 1 hour

        if (now - parsedData.timestamp < cacheExpiryTime) {
            return parsedData.data;
        }
    }

    const urls = {
        uab: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNDdKNRmuS_lu66UUjPilT7lUNXogFk3ByljcyJHDRIUoPh5Lk_PCQ0dp7I5Td-YL55KWe1_WCeku5/pub?gid=245625530&single=true&output=csv',
        aya: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNDdKNRmuS_lu66UUjPilT7lUNXogFk3ByljcyJHDRIUoPh5Lk_PCQ0dp7I5Td-YL55KWe1_WCeku5/pub?gid=1640510518&single=true&output=csv',
        cb: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNDdKNRmuS_lu66UUjPilT7lUNXogFk3ByljcyJHDRIUoPh5Lk_PCQ0dp7I5Td-YL55KWe1_WCeku5/pub?gid=605862732&single=true&output=csv',
        kbz: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNDdKNRmuS_lu66UUjPilT7lUNXogFk3ByljcyJHDRIUoPh5Lk_PCQ0dp7I5Td-YL55KWe1_WCeku5/pub?gid=1744659778&single=true&output=csv',
        mab: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNDdKNRmuS_lu66UUjPilT7lUNXogFk3ByljcyJHDRIUoPh5Lk_PCQ0dp7I5Td-YL55KWe1_WCeku5/pub?gid=1796926669&single=true&output=csv'
    };

    try {
        const response = await fetch(urls[bank]);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.text();
        const rows = data.split('\n').map(row => row.split(','));

        const cacheData = {
            data: rows,
            timestamp: Date.now()
        };

        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        return rows;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

async function showFeeTable(bank) {
    if (!feeTablesDiv) return;
    
    const existingTable = document.getElementById(`fee-table-${bank}`);
    if (existingTable) {
        existingTable.remove();
        return;
    }

    feeTablesDiv.innerHTML = '<div class="loading">Loading fee table...</div>';

    const rows = await fetchFeeData(bank);

    if (rows) {
        let tableHTML = `<table class="fee-table" id="fee-table-${bank}"><thead><tr>`;
        rows[0].forEach(header => {
            tableHTML += `<th>${header}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';

        for (let i = 1; i < rows.length; i++) {
            tableHTML += '<tr>';
            rows[i].forEach((cell, index) => {
                const cellValue = cell.trim();
                tableHTML += `<td>${index > 0 && !isNaN(cellValue) ? parseInt(cellValue).toLocaleString() + ' Ks' : cellValue}</td>`;
            });
            tableHTML += '</tr>';
        }
        tableHTML += '</tbody></table>';

        feeTablesDiv.innerHTML = tableHTML;
    } else {
        feeTablesDiv.innerHTML = '<div class="error">Failed to load fee table.</div>';
    }
}
// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', function() {
    // Theme setup
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (body && icon) {
        if (savedTheme === 'light') {
            body.classList.remove('dark-theme');
            body.classList.add('light-theme');
            icon.className = 'fas fa-moon';
        }
    }
    
    // Load rates
    if (rateTable) {
        fetchRates();
        setInterval(fetchRates, 30000);
    }

    // Preload fee data
    preloadFeeData();

    // Footer scroll effect
    if (footer) {
        let lastScrollTop = 0;
        window.addEventListener('scroll', function() {
            let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            footer.style.bottom = scrollTop > lastScrollTop ? '-100px' : '0';
            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        });
    }
});

async function preloadFeeData() {
    const banks = ['uab', 'aya', 'cb', 'kbz', 'mab'];
    for (const bank of banks) {
        await fetchFeeData(bank);
    }
}

// သင့် main JavaScript ဖိုင်ထဲမှာ
const SHEET_TYPES = ['uab', 'aya', 'cb', 'kbz', 'mab', 'exchange'];

// Service Worker Registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered for scope:', registration.scope);
        
        // Listen for updates from SW
        navigator.serviceWorker.addEventListener('message', event => {
          if (event.data.type === 'DATA_UPDATED') {
            const { sheetType } = event.data;
            if (sheetType === currentActiveTab) { // currentActiveTab က လက်ရှိ active tab
              fetchData(sheetType);
            }
          }
        });
      })
      .catch(err => console.error('SW registration failed:', err));
  }
}

// Fetch Data with Cache First Strategy
async function fetchData(sheetType) {
  const url = `https://docs.google.com/spreadsheets/d/e/...${sheetType}...`;
  
  try {
    // Try cache first
    const cache = await caches.open('visa-topup-cache-v3');
    const cachedResponse = await cache.match(url);
    
    if (cachedResponse) {
      const data = await cachedResponse.text();
      renderTable(data, sheetType);
    }
    
    // Then fetch fresh data
    const networkResponse = await fetch(`${url}&t=${Date.now()}`);
    const freshData = await networkResponse.text();
    renderTable(freshData, sheetType);
    
    // Update cache
    const response = new Response(freshData);
    await cache.put(url, response);
    
    // Notify other tabs
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'UPDATE_SHEET',
        sheetType: sheetType,
        data: freshData
      });
    }
  } catch (error) {
    console.error(`Error fetching ${sheetType} data:`, error);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  
  // Load initial data
  fetchData('uab'); // Default load UAB data
});
