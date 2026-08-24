// Progressive Web App Service Worker for Neon Highway
const CACHE_NAME = 'neon-highway-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './three.min.js',
  './peerjs.min.js',
  './audio.js',
  './models.js',
  './online.js',
  './game.js',
  './manifest.json'
];

// Install Event - cache core files
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching offline assets');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('SW: Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - cache-first fallback to network strategy
self.addEventListener('fetch', (e) => {
  // Only cache GET requests (WebRTC websocket requests can't be cached)
  if (e.request.method !== 'GET' || e.request.url.includes('peerjs') && !e.request.url.endsWith('.js')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        // Cache dynamic assets on the fly
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      });
    }).catch(() => {
      // Offline fallback if network fails and not in cache
      if (e.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
