// DOM Elements
const body = document.body;
const icon = document.querySelector('.theme-toggle i');
const returnToTopBtn = document.getElementById('return-to-top');
const rateTable = document.getElementById('rateTable');
const updateTimeElement = document.getElementById('updateTime');
const feeTablesDiv = document.getElementById('feeTables');
const footer = document.querySelector('.footer');
// NEW: Get reference to the image and copyright container
const imageCopyrightContainer = document.getElementById('image-copyright-container');
// NEW: Get reference to the fee buttons div (to determine insertion point later)
const feeButtonsDiv = document.querySelector('.fee-buttons');

// NEW: Store original position for the image and copyright container
let originalImageParent = null;
let originalImageNextSibling = null;


// Skeleton HTML for exchange table
// This will be used to reset the table content to skeleton state before fetching data
const exchangeTableSkeleton = `
    <table class="skeleton-table">
        <thead>
            <tr>
                <th><span class="loading-skeleton"></span></th>
                <th><span class="loading-skeleton"></span></th>
                <th><span class="loading-skeleton"></span></th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><span class="loading-skeleton"></span></td>
                <td><span class="loading-skeleton"></span></td>
                <td><span class="loading-skeleton"></span></td>
            </tr>
            <tr>
                <td><span class="loading-skeleton"></span></td>
                <td><span class="loading-skeleton"></span></td>
                <td><span class="loading-skeleton"></span></td>
            </tr>
            <tr>
                <td><span class="loading-skeleton"></span></td>
                <td><span class="loading-skeleton"></span></td>
                <td><span class="loading-skeleton"></span></td>
            </tr>
            <tr>
                <td><span class="loading-skeleton"></span></td>
                <td><span class="loading-skeleton"></span></td>
                <td><span class="loading-skeleton"></span></td>
            </tr>
            <tr>
                <td><span class="loading-skeleton"></span></td>
                <td><span class="loading-skeleton"></span></td>
                <td><span class="loading-skeleton"></span></td>
            </tr>
                </tbody>
            </table>
`;


// Theme Toggle
function toggleTheme() {
    if (!body || !icon) return;

    const isDark = body.classList.contains('dark-theme');
    body.classList.toggle('dark-theme', !isDark);
    body.classList.toggle('light-theme', isDark);
    icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun'; // Toggle icon
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

// Update Time - now also accepts a timestamp for when the data was last updated
function updateTime(timestamp = null) {
    if (!updateTimeElement) return;

    let displayDate;
    if (timestamp) {
        displayDate = new Date(timestamp);
    } else {
        displayDate = new Date();
    }
    
    const day = displayDate.getDate();
    const month = displayDate.toLocaleString('en-US', { month: 'long' });
    const year = displayDate.getFullYear();
    let hours = displayDate.getHours();
    const minutes = displayDate.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    const formattedTime = `${hours}:${minutes} ${ampm}`;
    const formattedDate = `${year} ${month} ${day}`;
    updateTimeElement.textContent = `Exchange rate last updated: ${formattedDate}, ${formattedTime}`;
}

// Retry logic wrapper for fetching data
async function fetchWithRetry(url, timeout = 10000, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout); // Set timeout

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId); // Clear timeout if fetch completes

            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (err) {
            // If it's the last attempt, re-throw the error
            if (attempt === retries) throw err;
            // Otherwise, wait a bit before retrying (optional: add exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); 
        }
    }
}

// Helper function to render the table HTML
function renderExchangeTable(rows) {
    if (!rateTable) return;

    let html = '<table><thead><tr>';
    rows[0].forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';
    for (let i = 1; i < rows.length; i++) {
        // Ensure row is not empty and has valid cells
        if (rows[i].length === 0 || (rows[i].length === 1 && rows[i][0].trim() === '')) continue; 
        html += '<tr>';
        rows[i].forEach((cell, idx) => {
            const value = cell.trim();
            let displayValue = value;
            // Check if it's the second column (idx === 1) AND it's a number
            if (idx === 1 && !isNaN(value)) {
                displayValue = value + ' Ks'; // Display without commas
            } else if (idx > 0 && !isNaN(value)) { // For other numeric columns (index > 0, excluding column 1)
                displayValue = parseInt(value).toLocaleString() + ' Ks'; // Display with commas
            }
            html += `<td>${displayValue}</td>`;
        });
        html += '</tr>';
    }
    html += '</tbody></table>';
    rateTable.innerHTML = html;
}

const EXCHANGE_RATE_CACHE_KEY = 'exchangeRatesCache';
const EXCHANGE_RATE_CACHE_EXPIRY_MS = 60 * 1000; // 1 minute cache expiry for exchange rates

// Fetch Exchange Rates with caching
async function fetchRates() {
    if (!rateTable || !updateTimeElement) return;

    const url = 'https://ratecache.htunlwinaung-hla03.workers.dev';
    
    // 1. Try to load from cache
    const cachedData = localStorage.getItem(EXCHANGE_RATE_CACHE_KEY);
    let renderedFromCache = false;

    if (cachedData) {
        try {
            const parsedCache = JSON.parse(cachedData);
            // Check if cache is fresh enough
            if (Date.now() - parsedCache.timestamp < EXCHANGE_RATE_CACHE_EXPIRY_MS) {
                console.log('Using cached exchange rates.');
                // Pass the raw string data to render and then parse it inside renderExchangeTable
                const rows = parsedCache.data.split('\n').map(row => row.split(','));
                renderExchangeTable(rows);
                updateTime(parsedCache.timestamp); // Use cached timestamp
                renderedFromCache = true;
            }
        } catch (e) {
            console.warn('Error parsing cached exchange rates:', e);
            localStorage.removeItem(EXCHANGE_RATE_CACHE_KEY); // Clear corrupt cache
        }
    }

    // 2. If not rendered from cache, show skeleton
    if (!renderedFromCache) {
        rateTable.innerHTML = exchangeTableSkeleton;
        updateTimeElement.textContent = 'Loading exchange rates...';
    }

    // 3. Always try to fetch fresh data (even if cached data was rendered, to revalidate)
    try {
        const freshDataString = await fetchWithRetry(url, 10000, 1); // 10s timeout, 1 retry
        const rows = freshDataString.split('\n').map(row => row.split(','));

        if (rows.length === 0 || rows[0].length === 0) {
            throw new Error('No data received from API.');
        }

        // Only update if data is different or if it wasn't rendered from cache
        const currentTimestamp = Date.now();
        localStorage.setItem(EXCHANGE_RATE_CACHE_KEY, JSON.stringify({ data: freshDataString, timestamp: currentTimestamp }));
        renderExchangeTable(rows); // Render the fresh data
        updateTime(currentTimestamp); // Update with current time

    } catch (error) {
        console.error('Rates Fetch Error:', error);
        if (!renderedFromCache) { // Only show error if no data (cached or network) was displayed
            rateTable.innerHTML = error.name === 'AbortError'
                ? '<div class="error">Loading timeout❕ Please refresh.</div>'
                : '<div class="error">Failed to load rates 🥺 . Please check your internet connection.</div>';
            updateTimeElement.textContent = 'Failed to load exchange rates.'; // Indicate error time
        } else {
            console.warn('Network fetch failed, but cached data was already displayed.');
            // Keep the previously displayed cached data, don't show an error over it.
        }
    }
}

// Fetch Fee Table Data (with caching)
let feeDataCache = {}; // Global cache for fee data

async function fetchFeeData(bank) {
    const cacheKey = `feeData-${bank}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            // Cache valid for 24 hours (86,400,000 milliseconds)
            if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
                console.log(`Using cached data for ${bank}`);
                return parsed.data; 
            }
        } catch (e) {
            console.warn('Error parsing cached fee data:', e);
            localStorage.removeItem(cacheKey); // Clear corrupt cache
        }
    }

    const urls = {
        uab: 'https://script.google.com/macros/s/AKfycbzh8uaqQeliA3ermIXm39XHnkXg5swV42dgb_Hoex-mTaTcdK3MeVPCwkoaBLxamCYl/exec?sheetName=uab',
        aya: 'https://script.google.com/macros/s/AKfycbzh8uaqQeliA3ermIXm39XHnkXg5swV42dgb_Hoex-mTaTcdK3MeVPCwkoaBLxamCYl/exec?sheetName=aya',
        cb: 'https://script.google.com/macros/s/AKfycbzh8uaqQeliA3ermIXm39XHnkXg5swV42dgb_Hoex-mTaTcdK3MeVPCwkoaBLxamCYl/exec?sheetName=cb',
        kbz: 'https://script.google.com/macros/s/AKfycbzh8uaqQeliA3ermIXm39XHnkXg5swV42dgb_Hoex-mTaTcdK3MeVPCwkoaBLxamCYl/exec?sheetName=kbz',
        mab: 'https://script.google.com/macros/s/AKfycbzh8uaqQeliA3ermIXm39XHnkXg5swV42dgb_Hoex-mTaTcdK3MeVPCwkoaBLxamCYl/exec?sheetName=mab'
    };

    try {
        const data = await fetchWithRetry(urls[bank], 10000, 1);
        const rows = data.split('\n').map(r => r.split(','));
        localStorage.setItem(cacheKey, JSON.stringify({ data: rows, timestamp: Date.now() }));
        return rows;
    } catch (error) {
        console.error(`Fee Fetch Error for ${bank}:`, error);
        return null;
    }
}

// Global variable to store the observer for fee table rows
let currentFeeTableObserver = null;

// NEW function to initialize row animations
function initializeTableRowAnimations() {
    // Disconnect any previous observer if it exists to clean up
    if (currentFeeTableObserver) {
        currentFeeTableObserver.disconnect();
        currentFeeTableObserver = null;
    }

    const feeTable = feeTablesDiv.querySelector('.fee-table');
    if (!feeTable) return; // No fee table found to animate

    // Select all table body rows (exclude header rows)
    const rows = feeTable.querySelectorAll('tbody tr');

    const observerOptions = {
        root: null, // Use the viewport as the root
        rootMargin: '0px',
        threshold: 0.1 // Trigger when 10% of the row is visible
    };

    const observerCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add the animation class when the row enters the viewport
                entry.target.classList.add('fade-in-up');
                // Stop observing this row once it has animated
                observer.unobserve(entry.target);
            }
        });
    };

    // Create a new IntersectionObserver instance
    currentFeeTableObserver = new IntersectionObserver(observerCallback, observerOptions);

    // Observe each row
    rows.forEach((row, index) => {
        // Set a staggered delay for each row's animation
        row.style.transitionDelay = `${index * 0.01}s`; 
        currentFeeTableObserver.observe(row); 
    });
}

// MODIFIED showFeeTable function
async function showFeeTable(bank) {
    if (!feeTablesDiv || !imageCopyrightContainer || !feeButtonsDiv) return;

    const existing = document.getElementById(`fee-table-${bank}`);
    
    // Check if the image/copyright is currently within the feeTablesDiv
    const imageIsCurrentlyInFeeTablesDiv = feeTablesDiv.contains(imageCopyrightContainer);

    if (existing) {
        // If the table is already displayed, hide it with a fade-out animation
        // Set opacity and transform to initial hidden state to trigger CSS transition
        existing.style.opacity = '0';
        existing.style.transform = 'translateY(20px)';
        
        // Disconnect observer for the table being hidden to prevent memory leaks
        if (currentFeeTableObserver) {
            currentFeeTableObserver.disconnect();
            currentFeeTableObserver = null;
        }

        // Delay removal from DOM to allow the fade-out transition to complete
        setTimeout(() => {
            existing.remove(); 
            feeTablesDiv.innerHTML = ''; // Clear feeTablesDiv content after removal
            
            // Move image & copyright back to original position
            if (originalImageParent && imageCopyrightContainer) {
                 originalImageParent.insertBefore(imageCopyrightContainer, originalImageNextSibling);
            }
        }, 500); // The timeout duration should match the CSS transition duration (0.5s)
        return;
    }

    // Clear any previously loaded fee tables and show loading state
    feeTablesDiv.innerHTML = '<div class="loading">Loading fee table...</div>';
    
    // If the image was in its original spot, remove it before loading the table
    if (!imageIsCurrentlyInFeeTablesDiv && imageCopyrightContainer && imageCopyrightContainer.parentNode) {
        imageCopyrightContainer.remove();
    }

    const rows = await fetchFeeData(bank);

    if (rows) {
        let html = `<table class="fee-table" id="fee-table-${bank}"><thead><tr>`;
        rows[0].forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';
        for (let i = 1; i < rows.length; i++) {
            if (rows[i].length === 0 || (rows[i].length === 1 && rows[i][0].trim() === '')) continue; 
            html += '<tr>'; // Each row will start invisible and slide up, then be revealed by JS
            rows[i].forEach((cell, idx) => {
                const value = cell.trim();
                html += `<td>${idx > 0 && !isNaN(value) ? parseInt(value).toLocaleString() + ' Ks' : value}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody></table>';
        feeTablesDiv.innerHTML = html; // Display the fetched table

        // NEW LINE: Initialize row animations after the table is rendered
        initializeTableRowAnimations();

        // After displaying table, append image and copyright below it
        if (imageCopyrightContainer) {
            feeTablesDiv.appendChild(imageCopyrightContainer);
        }
    } else {
        feeTablesDiv.innerHTML = '<div class="error">Failed to load fee table. Please try again later.</div>';
        // If an error occurs, ensure the image goes back to its original spot if it was moved
        if (imageCopyrightContainer && originalImageParent && !originalImageParent.contains(imageCopyrightContainer)) {
             originalImageParent.insertBefore(imageCopyrightContainer, originalImageNextSibling);
        }
    }
}

// Preload Fee Tables (fetches data and stores in cache, doesn't display)
async function preloadFeeData() {
    const banks = ['uab', 'aya', 'cb', 'kbz', 'mab'];
    for (const bank of banks) {
        await fetchFeeData(bank);
    }
}

// Service Worker (Optional - for PWA features like offline support)
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                console.log('Service Worker Registered:', reg.scope);
                // Optional: Add listeners for service worker messages
                // navigator.serviceWorker.addEventListener('message', event => {
                //     if (event.data.type === 'DATA_UPDATED') {
                //         // If your service worker sends data updates, handle them here
                //         // For example, refetch rates if a background update occurred
                //         fetchRates();
                //     }
                // });
            })
            .catch(err => console.error('Service Worker Registration Failed:', err));
    }
}

// Initialization on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Apply theme from localStorage on page load
    const theme = localStorage.getItem('theme') || 'dark'; // Default to dark if no theme found
    body.classList.toggle('light-theme', theme === 'light');
    body.classList.toggle('dark-theme', theme !== 'light');
    icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';

    // Set copyright text
    const copyrightElement = document.getElementById('copyright-text');
    if (copyrightElement) {
        const currentYear = new Date().getFullYear();
        copyrightElement.textContent = `2019 - ${currentYear} copyright @Visa Topup Myanmar`;
    }

    // Store the original position of the image-copyright-container AFTER the DOM is fully loaded
    // This is crucial to ensure originalImageParent and originalImageNextSibling are valid
    if (imageCopyrightContainer && feeButtonsDiv) {
        originalImageParent = imageCopyrightContainer.parentNode;
        originalImageNextSibling = imageCopyrightContainer.nextSibling;
    }


    // Fetch and display exchange rates when the page loads
    fetchRates();
    // Set interval to refresh rates every 1 minute (60000 milliseconds)
    // The fetchRates function itself now handles showing cache and revalidating.
    // So, we just need to call it periodically to trigger the refresh.
    setInterval(fetchRates, 60000); 

    // Preload fee data into cache for faster display when buttons are clicked
    preloadFeeData();

    // Register service worker (if sw.js file exists in root)
    registerServiceWorker();

    // Footer scroll animation: hide on scroll down, show on scroll up
    if (footer) {
        let lastScrollTop = 0;
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            // Only hide if scrolling down AND not at the very top of the page
            footer.style.bottom = (scrollTop > lastScrollTop && scrollTop > 50) ? '-100px' : '0';
            lastScrollTop = Math.max(scrollTop, 0); // Ensure lastScrollTop is never negative
        });
    }
});
