const CACHE_NAME = 'menage-manager-v3';

// Only cache static assets, never JS files or API calls
const CACHEABLE = /\.(png|jpg|jpeg|svg|gif|woff2?|ttf|eot)$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Never cache: JS files, API calls, Supabase, HTML
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.html') ||
      url.hostname.includes('supabase') || url.pathname.startsWith('/rest/') ||
      url.pathname.startsWith('/auth/') || url.pathname.startsWith('/functions/')) {
    return; // Let browser handle normally (no cache)
  }

  // Cache static assets only (images, fonts)
  if (CACHEABLE.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return resp;
        });
      })
    );
  }
  // All other requests: network only, no caching
});
