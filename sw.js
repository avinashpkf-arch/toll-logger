// Keeps the app, the Excel tool and fonts on the phone after the first download.
// The page itself is always fetched fresh when there is signal, so updates arrive straight away.
const CACHE = 'toll-v3';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'manifest.webmanifest', 'icon-192.png'])).catch(() => {})); });
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.hostname.endsWith('google.com') || u.hostname.endsWith('googleusercontent.com')) return;   // sheet sync: never cached
  const heavy = u.hostname === 'cdnjs.cloudflare.com' || u.hostname.startsWith('fonts.');
  if (heavy) {            // cache first
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(r); if (hit) return hit;
      const res = await fetch(r); if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res;
    }));
  } else if (u.origin === location.origin) {   // page, icons: network first, cached copy when offline
    e.respondWith(fetch(r).then(res => { if (res.ok) caches.open(CACHE).then(c => c.put(r, res.clone())); return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(h => h || caches.match('./'))));
  }
});
