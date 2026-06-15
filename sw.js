const APP_VERSION = '9.94';
const CACHE_NAME = 'lokizio-v' + APP_VERSION;

// App shell files to cache for offline support.
// Since v9.60, modules are served as .min.js (built by esbuild — see scripts/build.js).
// supabase_config.js is NOT built (small + contains Stripe key, kept clear for easy update).
const APP_SHELL = [
  './',
  './index.html',
  './app.css',
  './sentry-init.min.js',
  './supabase_config.js',
  './helpers.min.js',
  './i18n.min.js',
  './ical_parser.min.js',
  './api_bridge.min.js',
  './auth.min.js',
  './dashboard.min.js',
  './account.min.js',
  './admin-prestations.min.js',
  './admin-sentry.min.js',
  './auto-billing.min.js',
  './invoice-create.min.js',
  './invoices.min.js',
  './legal.min.js',
  './legal-fill.min.js',
  './marketplace.min.js',
  './owner.min.js',
  './properties.min.js',
  './provider.min.js',
  './push.min.js',
  './quotes.min.js',
  './search.min.js',
  './tenant.min.js',
  './vacation.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.json',
];

// Static assets (images, fonts)
const CACHEABLE_STATIC = /\.(png|jpg|jpeg|svg|gif|woff2?|ttf|eot)$/;

// v9.88: split APP_SHELL en 2 tiers pour reduire la fenetre d'install bloquante.
// Avant: cache.addAll(30 fichiers) sur le chemin critique de waitUntil -> ~1.5-2s
// de bande passante volee aux requetes du boot a chaque install.
// Maintenant: 8 fichiers critiques en addAll bloquant, le reste en fire-and-forget
// hors waitUntil (donc l'install se termine en ~300-500ms).
const CRITICAL_SHELL = [
  './',
  './index.html',
  './app.css',
  './supabase_config.js',
  './helpers.min.js',
  './i18n.min.js',
  './api_bridge.min.js',
  './auth.min.js',
];
const LAZY_SHELL = APP_SHELL.filter(p => !CRITICAL_SHELL.includes(p));

self.addEventListener('install', event => {
  // v9.94 perf: install ne pre-cache QUE CRITICAL_SHELL. LAZY_SHELL est defere
  // au signal SW_BOOT_COMPLETE du client (apres init() done dans index.html).
  // Avant: 22 fetch reseau de LAZY_SHELL en fire-and-forget volaient ~440ms de
  // bande passante au critical path sur 4G.
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CRITICAL_SHELL))
  );
  self.skipWaiting();
});

// v9.94: pre-cache LAZY_SHELL uniquement quand le client signale boot complete.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SW_BOOT_COMPLETE') {
    caches.open(CACHE_NAME).then(cache => {
      Promise.allSettled(LAZY_SHELL.map(async p => {
        const existing = await cache.match(p, { ignoreSearch: true });
        if (!existing) return cache.add(p);
      }));
    });
  }
});

self.addEventListener('activate', event => {
  // v9.88: ne supprime QUE les caches d'anciennes versions (pattern standard).
  // Avant: wipe all + postMessage SW_FORCE_RELOAD a chaque activate -> double reload
  // a chaque bump = ~3-5s de latence boot. Voir workflow w21x75q30 (regression v9.87).
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
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

  // v9.94 perf: cache-first agressif pour .min.js?v=<hash> (content-addressed, immutables
  // par construction via bump.js). HTML/CSS non-hashes en stale-while-revalidate.
  // Avant: network-first -> 30 round-trips reseau a chaque boot meme quand tout en cache.
  // IMPORTANT: respondWith MUST receive a Response — never undefined.
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/' || url.pathname.endsWith('/')) {
    const isHashedJs = url.pathname.endsWith('.min.js') && url.searchParams.has('v');
    if (isHashedJs) {
      event.respondWith(
        caches.match(event.request, { ignoreSearch: false }).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(resp => {
            if (resp.ok) {
              const clone = resp.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return resp;
          }).catch(async () => {
            const fallback = await caches.match(event.request, { ignoreSearch: true });
            return fallback || new Response('Offline and not cached', {
              status: 503, statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' },
            });
          });
        })
      );
      return;
    }
    // HTML / CSS / non-hashed JS: stale-while-revalidate (cache servi instantanement).
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cached => {
        const networkFetch = fetch(event.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return resp;
        }).catch(() => cached || new Response('Offline and not cached', {
          status: 503, statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        }));
        return cached || networkFetch;
      })
    );
    return;
  }

  // Static assets: cache-first (also tolerant to query strings).
  if (CACHEABLE_STATIC.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(resp => {
            if (resp.ok) {
              const clone = resp.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return resp;
          })
          .catch(() => new Response('Asset unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          }));
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
    body: data.body || '',
    icon: '/lokizio/icons/icon-192.png',
    badge: '/lokizio/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'lokizio',
    renotify: true,
    data: { url: data.url || '/lokizio/' },
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
