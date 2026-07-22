const CACHE = 'forja-shell-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './assets/icon.svg',
  './css/tokens.css', './css/app.css', './css/responsive.css',
  './js/app.js', './js/db.js', './js/generator.js', './js/parsers.js',
  './js/planner.js', './js/profile.js', './js/scheduler.js', './js/sessions.js', './js/ui.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok && new URL(event.request.url).origin === location.origin) {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(error => event.request.mode === 'navigate' ? caches.match('./index.html') : Promise.reject(error))));
});
