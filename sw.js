// ========== การตั้งค่าแคช ==========
const APP_CACHE_NAME = 'gis-survey-app-v2'; // เปลี่ยนเวอร์ชันเพื่ออัปเดตแคช
const MAP_CACHE_NAME = 'map-tiles-v2'; // เปลี่ยนเวอร์ชันเพื่ออัปเดตแคช

// ไฟล์แอปที่ต้องการแคช
const urlsToCache = [
  '/',
  '/index.html',
  '/static/icons/lb.ico',
  '/static/icons/lb-192.png',
  '/static/icons/lb-512.png'
];

// URL ของไทล์แผนที่ที่ต้องการแคช
const TILE_URLS = [
  'https://mt0.google.com',
  'https://mt1.google.com',
  'https://mt2.google.com',
  'https://mt3.google.com'
];

// ========== Event: Install (ติดตั้ง) ==========
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // แคชไฟล์แอปพื้นฐาน
      caches.open(APP_CACHE_NAME).then((cache) => {
        console.log('Caching app assets...');
        return cache.addAll(urlsToCache).catch((err) => {
          console.warn('Failed to cache app assets:', err);
        });
      }),
      
      // เตรียมแคชไทล์แผนที่ (ยังไม่โหลด รอให้ผู้ใช้เรียกดูจริงๆ)
      caches.open(MAP_CACHE_NAME).then((cache) => {
        console.log('Map tile cache ready');
      })
    ]).then(() => {
      console.log('Service Worker installed successfully');
      return self.skipWaiting(); // ใช้งานทันทีโดยไม่รอ
    })
  );
});

// ========== Event: Fetch (ดึงข้อมูล) ==========
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // ตรวจสอบว่าเป็นคำขอไทล์แผนที่หรือไม่
  if (TILE_URLS.some(tileUrl => url.startsWith(tileUrl))) {
    event.respondWith(
      handleMapTileRequest(event.request)
    );
  } else {
    // คำขออื่นๆ (ไฟล์แอป, API, etc.)
    event.respondWith(
      handleAppRequest(event.request)
    );
  }
});

// จัดการคำขอไทล์แผนที่
async function handleMapTileRequest(request) {
  const cache = await caches.open(MAP_CACHE_NAME);
  
  try {
    // 1. ตรวจสอบว่ามีในแคชหรือไม่
    const cachedResponse = await cache.match(request);
    
    // 2. ดึงจากเครือข่ายพร้อมกัน (อัปเดตแคช)
    const networkFetch = fetch(request).then(async (networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        // บันทึกหรืออัปเดตในแคช
        await cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }).catch(() => {
      // หากไม่มีอินเทอร์เน็ต ใช้แคช
      return cachedResponse;
    });
    
    // 3. แสดงจากแคชทันที แล้วอัปเดตจากเครือข่าย
    return cachedResponse || networkFetch;
    
  } catch (err) {
    console.error('Error handling map tile request:', err);
    return fetch(request); // กลับไปใช้วิธีปกติ
  }
}

// จัดการคำขอไฟล์แอป
async function handleAppRequest(request) {
  const cache = await caches.open(APP_CACHE_NAME);
  
  try {
    // ลองดึงจากแคชก่อน
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // หากไม่มีในแคช ดึงจากเครือข่าย
    const networkResponse = await fetch(request);
    
    // บันทึกในแคช (สำหรับไฟล์ที่ไม่ใช่ไทล์)
    if (request.url.startsWith(self.location.origin)) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (err) {
    console.error('Error handling app request:', err);
    return caches.match(request); // ลองดึงจากแคชอีกครั้ง
  }
}

// ========== Event: Activate (เปิดใช้งาน) ==========
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // ลบแคชเก่าที่ไม่ใช้แล้ว
          if (cacheName !== APP_CACHE_NAME && cacheName !== MAP_CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated successfully');
      return self.clients.claim(); // ใช้งานทันทีกับแท็บที่เปิดอยู่
    })
  );
});

// ========== เคล็ดลับเพิ่มเติม ==========
// จำกัดขนาดแคชไทล์ (ป้องกันเต็ม)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAN_MAP_CACHE') {
    cleanMapCache();
  }
});

async function cleanMapCache() {
  const cache = await caches.open(MAP_CACHE_NAME);
  const keys = await cache.keys();
  
  // จำกัดจำนวนไทล์ในแคช (เช่น 100 ชิ้น)
  const MAX_TILES = 100;
  
  if (keys.length > MAX_TILES) {
    // ลบไทล์เก่าที่สุดออก
    const tilesToDelete = keys.slice(0, keys.length - MAX_TILES);
    await Promise.all(
      tilesToDelete.map(key => cache.delete(key))
    );
    console.log(`Cleaned map cache: deleted ${tilesToDelete.length} old tiles`);
  }
}
