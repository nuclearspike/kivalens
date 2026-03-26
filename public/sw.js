// KivaLens Service Worker
const CACHE_NAME = 'kivalens-v1';
const STATIC_ASSETS = [
  '/',
  '/javascript/build.js',
  '/javascript/vendor.js',
  '/stylesheets/application.min.css'
];

// Install: pre-cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API/data, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls, proxy, and external requests — always go to network
  if (url.pathname.startsWith('/proxy/') ||
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/graphql') ||
      url.hostname !== self.location.hostname) {
    return;
  }

  // Static assets: cache-first
  if (url.pathname.startsWith('/javascript/') ||
      url.pathname.startsWith('/stylesheets/') ||
      url.pathname.match(/\.(png|jpg|ico|svg|woff|woff2|ttf)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else: network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
