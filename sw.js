const CACHE = 'iron-log-v5';
const APP_FILES = ['./', './index.html', './manifest.json', './icon.png', './watch.js?v=4'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all(['iron-log-v1', 'iron-log-v2', 'iron-log-v3', 'iron-log-v4'].map(key => caches.delete(key))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(event.request)) || Response.error();
  }));
});
