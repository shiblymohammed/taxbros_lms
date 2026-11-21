/*
 * TAXBROS LMS service worker (Task 63, R32).
 *
 * Scope is deliberately narrow: it caches only the manifest and app icons so the app is
 * installable and its icon loads quickly. Pages, API calls and videos always go to the
 * network; there is no offline mode (out of MVP scope).
 */
const CACHE = 'taxbros-shell-v1';
const ASSETS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !ASSETS.includes(url.pathname)) {
    return; // not ours: let the browser handle it normally
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
