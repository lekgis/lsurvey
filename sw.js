// sw.js
const CACHE_NAME = 'gis-survey-app-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/icons/lb.ico',
  '/static/icons/lb-192.png',
  '/static/icons/lb-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});