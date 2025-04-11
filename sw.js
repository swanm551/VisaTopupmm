// public/sw.js
const CACHE_NAME = 'visa-topup-cache-v3';
const SHEETS_CONFIG = {
  uab: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNDdKNRmuS_lu66UUjPilT7lUNXogFk3ByljcyJHDRIUoPh5Lk_PCQ0dp7I5Td-YL55KWe1_WCeku5/pub?gid=245625530&single=true&output=csv',
  aya: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNDdKNRmuS_lu66UUjPilT7lUNXogFk3ByljcyJHDRIUoPh5Lk_PCQ0dp7I5Td-YL55KWe1_WCeku5/pub?gid=1640510518&single=true&output=csv',
  cb: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNDdKNRmuS_lu66UUjPilT7lUNXogFk3ByljcyJHDRIUoPh5Lk_PCQ0dp7I5Td-YL55KWe1_WCeku5/pub?gid=605862732&single=true&output=csv',
  kbz: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNDdKNRmuS_lu66UUjPilT7lUNXogFk3ByljcyJHDRIUoPh5Lk_PCQ0dp7I5Td-YL55KWe1_WCeku5/pub?gid=1744659778&single=true&output=csv',
  mab: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNDdKNRmuS_lu66UUjPilT7lUNXogFk3ByljcyJHDRIUoPh5Lk_PCQ0dp7I5Td-YL55KWe1_WCeku5/pub?gid=1796926669&single=true&output=csv',
  exchange: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNDdKNRmuS_lu66UUjPilT7lUNXogFk3ByljcyJHDRIUoPh5Lk_PCQ0dp7I5Td-YL55KWe1_WCeku5/pub?gid=0&single=true&output=csv',
  shein: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQMEfkm2e1w-xg5P-iQGJNjGCECWkHW-qHKr-tDfm971K70C8874Grf66mMHow0kOkyskk4EaXPCng_/pub?gid=1852260511&single=true&output=csv',
  thaiph: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQMEfkm2e1w-xg5P-iQGJNjGCECWkHW-qHKr-tDfm971K70C8874Grf66mMHow0kOkyskk4EaXPCng_/pub?gid=1899732459&single=true&output=csv',
  cashout: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQMEfkm2e1w-xg5P-iQGJNjGCECWkHW-qHKr-tDfm971K70C8874Grf66mMHow0kOkyskk4EaXPCng_/pub?gid=2001411383&single=true&output=csv'
};

// Install Event - Cache all resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(Object.values(SHEETS_CONFIG));
      })
  );
});

// Fetch Event - Handle requests
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const sheetType = Object.keys(SHEETS_CONFIG).find(key => url.includes(SHEETS_CONFIG[key]));
  
  if (sheetType) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          // Always fetch from network in background
          const fetchPromise = fetch(`${url}&t=${Date.now()}`)
            .then(networkResponse => {
              // Update cache
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, networkResponse.clone()));
              
              // Notify clients about update
              self.clients.matchAll().then(clients => {
                clients.forEach(client => client.postMessage({
                  type: 'DATA_UPDATED',
                  sheetType: sheetType,
                  timestamp: Date.now()
                }));
              });
              
              return networkResponse;
            })
            .catch(() => cachedResponse); // Fallback to cache if network fails
          
          // Return cached version immediately, then update
          return cachedResponse || fetchPromise;
        })
    );
  } else {
    // For non-sheet requests
    event.respondWith(fetch(event.request));
  }
});

// Message Event - Handle updates from client
self.addEventListener('message', (event) => {
  if (event.data.type === 'UPDATE_SHEET') {
    const { sheetType, data } = event.data;
    const url = SHEETS_CONFIG[sheetType];
    
    if (url) {
      caches.open(CACHE_NAME)
        .then(cache => {
          const response = new Response(data, {
            headers: { 'Content-Type': 'text/csv' }
          });
          return cache.put(url, response);
        });
    }
  }
});
