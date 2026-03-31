const APP_VERSION = '6.57';
const CACHE_NAME = 'lokizio-v' + APP_VERSION;

// App shell files to cache for offline support
const APP_SHELL = [
  './',
  './index.html',
  './supabase_config.js',
  './i18n.js',
  './ical_parser.js',
  './api_bridge.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.json',
];

// Static assets (images, fonts)
const CACHEABLE_STATIC = /\.(png|jpg|jpeg|svg|gif|woff2?|ttf|eot)$/;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

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

  // Never intercept: API calls, Supabase, Edge Functions, sw.js itself
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/rest/') ||
      url.pathname.startsWith('/auth/') || url.pathname.startsWith('/functions/') ||
      url.pathname.endsWith('sw.js')) {
    return;
  }

  // App shell files: network-first, fallback to cache (stale-while-revalidate)
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return resp;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets: cache-first
  if (CACHEABLE_STATIC.test(url.pathname)) {
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
    return;
  }
});

// Push notification handler
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Lokizio';
  const options = {
    body: data.body || 'Nouveau menage assigne',
    icon: '/lokizio/icons/icon-192.png',
    badge: '/lokizio/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/lokizio/view.html' },
    actions: [
      { action: 'open', title: data.actionOpen || 'Voir' },
      { action: 'dismiss', title: data.actionDismiss || 'Fermer' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Click on notification
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/lokizio/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes('lokizio') && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
