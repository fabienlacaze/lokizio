const APP_VERSION = '5.07';
const CACHE_NAME = 'lokizio-v' + APP_VERSION;

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
    return;
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
      { action: 'open', title: 'Voir' },
      { action: 'dismiss', title: 'Fermer' }
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
