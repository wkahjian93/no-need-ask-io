// Network first and always revalidated, so phones get updates as soon as they are online; falls back to the cache offline.
// The guides themselves are kept in IndexedDB by app.js, not here.
const CACHE = 'nnaio-v6';
const FILES = ['./', 'index.html', 'style.css', 'config.js', 'match.js', 'near.js', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request, {cache: 'no-cache'}).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match(e.request, {ignoreSearch: true})));
});
