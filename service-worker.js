const RELEASE_VERSION = '2026.07.26-1';
const CACHE = `forja-shell-${RELEASE_VERSION}`;
const SHELL = [
  './', './index.html', './manifest.webmanifest', './assets/icon.svg',
  './css/tokens.css', './css/app.css', './css/responsive.css',
  './js/account.js', './js/account-restore.js', './js/app.js', './js/backup.js', './js/config.js',
  './js/db.js', './js/drawer.js', './js/energy.js',
  './js/focus.js', './js/generator.js', './js/parsers.js', './js/planner.js',
  './js/profile.js', './js/scheduler.js', './js/sessions.js', './js/streak.js',
  './js/sync-client.js', './js/sync-config.js', './js/theme.js', './js/ui.js', './js/vault.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const sameOrigin = new URL(event.request.url).origin === location.origin;
  if (sameOrigin) {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request, { ignoreSearch: true }).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : Promise.reject(new Error('offline'))))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
