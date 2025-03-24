function toggleTheme() {
    const body = document.body;
    const icon = document.querySelector('.theme-toggle i');
    
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

window.onscroll = function() {
    if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        document.getElementById('return-to-top').style.display = 'flex';
    } else {
        document.getElementById('return-to-top').style.display = 'none';
    }
};

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

async function fetchRates() {
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNDdKNRmuS_lu66UUjPilT7lUNXogFk3ByljcyJHDRIUoPh5Lk_PCQ0dp7I5Td-YL55KWe1_WCeku5/pub?output=csv&gid=0';
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const data = await response.text();
        const rows = data.split('\n').map(row => row.split(','));
        
        let tableHTML = '<table><thead><tr>';
        rows[0].forEach(header => {
            tableHTML += `<th>${header}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';
        
        for (let i = 1; i < rows.length; i++) {
            tableHTML += '<tr>';
            rows[i].forEach((cell, index) => {
                if (index > 0 && !isNaN(cell.trim())) {
                    tableHTML += `<td>${cell.trim()} Ks</td>`;
                } else {
                    tableHTML += `<td>${cell}</td>`;
                }
            });
            tableHTML += '</tr>';
        }
        tableHTML += '</tbody></table>';
        
        document.getElementById('rateTable').innerHTML = tableHTML;
        updateTime();
    } catch (error) {
        if (error.name === 'AbortError') {
            document.getElementById('rateTable').innerHTML = '<div class="error">Loading timeout. Please refresh.</div>';
        } else {
            console.error('Error:', error);
            document.getElementById('rateTable').innerHTML = '<div class="error">Failed to load rates.</div>';
        }
    }
}

function updateTime() {
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
    document.getElementById('updateTime').textContent = 
        `Exchange rate last updated: ${timeString}, ${dateString}`;
}

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
    const feeTablesDiv = document.getElementById('feeTables');
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
                if (index > 0 && !isNaN(cell.trim())) {
                    tableHTML += `<td>${cell.trim()} Ks</td>`;
                } else {
                    tableHTML += `<td>${cell}</td>`;
                }
            });
            tableHTML += '</tr>';
        }
        tableHTML += '</tbody></table>';

        feeTablesDiv.innerHTML = tableHTML;
    } else {
        feeTablesDiv.innerHTML = '<div class="error">Failed to load fee table.</div>';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const body = document.body;
    const icon = document.querySelector('.theme-toggle i');
    
    if (savedTheme === 'light') {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        icon.className = 'fas fa-moon';
    }
    
    fetchRates();
    setInterval(fetchRates, 30000);

    preloadFeeData();
});

async function preloadFeeData() {
    const banks = ['uab', 'aya', 'cb', 'kbz', 'mab'];
    for (const bank of banks) {
        await fetchFeeData(bank);
    }
}

let lastScrollTop = 0;
const footer = document.querySelector('.footer');

window.addEventListener('scroll', function() {
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > lastScrollTop) {
        footer.style.bottom = '-100px';
    } else {
        footer.style.bottom = '0';
    }
    
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
});

// Subpage loader function
function loadSubpageTable(bank) {
    const container = document.getElementById('subpageTableContainer');
    container.innerHTML = '<div class="loading">Loading fee table...</div>';
    
    fetchFeeData(bank)
        .then(rows => {
            if (!rows || rows.length === 0) throw new Error('No data');
            
            let html = `<table class="subpage-table">
                <thead><tr>${rows[0].map(h => `<th>${h}</th>`).join('')}</tr></thead>
                <tbody>`;
            
            for (let i = 1; i < rows.length; i++) {
                html += `<tr>${rows[i].map((cell, j) => 
                    `<td>${j > 0 && !isNaN(cell) ? cell + ' Ks' : cell}</td>`
                ).join('')}</tr>`;
            }
            
            container.innerHTML = html + '</tbody></table>';
        })
        .catch(error => {
            container.innerHTML = '<div class="error">Failed to load fee table. Please try again later.</div>';
        });
}
