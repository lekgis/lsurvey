// sw.js - Service Worker for caching map tiles
const CACHE_NAME = 'map-tiles-v2'; // Increment version if changing caching logic significantly
const TILE_BASE_URLS = [
  'https://mt0.google.com/', // Use the base URL strings from CONFIG
  'https://mt1.google.com/',
  'https://mt2.google.com/',
  'https://mt3.google.com/'
];

// Install event: Open the cache
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  // Focus the client window after installation to ensure it takes control immediately
  self.skipWaiting();
});

// Fetch event: Intercept requests and handle caching for tiles
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Check if the request URL starts with any of the tile base URLs
  const isTileRequest = TILE_BASE_URLS.some(base => url.href.startsWith(base));

  if (isTileRequest) {
    // Handle tile caching strategy: Try cache first, then network, update cache
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        // Attempt to find the request in the cache first
        return cache.match(event.request).then((cachedResponse) => {
          // Start fetching from the network in the background
          const networkFetchPromise = fetch(event.request).then((networkResponse) => {
            // If the network response is successful, put a clone into the cache
            if (networkResponse && networkResponse.status === 200) {
               cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((networkError) => {
            // If network fails, return the cached response if available
            if (cachedResponse) {
              console.warn(`Network failed for ${event.request.url}, served from cache.`);
              return cachedResponse;
            }
            // Otherwise, re-throw the network error
            throw networkError;
          });

          // Return the cached response immediately if available, otherwise wait for network
          return cachedResponse || networkFetchPromise;
        });
      })
    );
  }
  // For non-tile requests (HTML, JS, CSS, icons, etc.), use default browser behavior
  // or implement a different strategy if needed.
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches that don't match the current name
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated and old caches cleaned.');
      // Claim clients to take control of pages immediately
      return self.clients.claim();
    })
  );
});
