/*
 * Báhay's service worker: keeps solo play working with no connection once the
 * game has been opened once.
 *
 *   pages        network first, falling back to the cached shell offline,
 *                so a new deploy is picked up as soon as there is a signal
 *   _expo/, assets/
 *                cache first — Expo names these by content hash, so a cached
 *                copy can never be stale
 *   everything else on this origin
 *                served from cache, refreshed in the background
 *   other origins (the online table server)
 *                never cached: a table's state must always be live
 */

const VERSION = 'bahay-v2';
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const scope = new URL(self.registration.scope);
const shellUrl = new URL('./', scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([shellUrl]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Static hosts answer deep links (/table) with 404.html and a 404
          // status. That page is the app, but never keep a 404 as the shell.
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put(shellUrl, copy));
          }
          return response;
        })
        .catch(() => caches.match(shellUrl)),
    );
    return;
  }

  const path = url.pathname.slice(scope.pathname.length);
  if (path.startsWith('_expo/') || path.startsWith('assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.open(STATIC).then((cache) =>
      cache.match(request).then((hit) => {
        const refresh = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => hit);
        return hit || refresh;
      }),
    ),
  );
});
