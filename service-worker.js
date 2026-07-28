const RELEASE_VERSION = '2026.07.28-10';
const CACHE = `forja-shell-${RELEASE_VERSION}`;
const SHELL = [
  './', './index.html', './404.html', './offline.html',
  './manifest.webmanifest', './assets/icon.svg',
  './css/tokens.css', './css/app.css', './css/buenaventura.css', './css/responsive.css', './css/ux.css',
  './css/projects.css', './css/sources.css', './css/rubrics.css', './css/evidence.css',
  './css/reports.css', './css/presentations.css',
  './js/account.js', './js/account-restore.js', './js/app.js', './js/backup.js', './js/config.js',
  './js/db.js', './js/drawer.js', './js/energy.js',
  './js/exam.js', './js/calibration.js', './js/focus.js', './js/generator.js', './js/parsers.js', './js/planner.js',
  './js/profile.js', './js/scheduler.js', './js/sessions.js', './js/streak.js',
  './js/sync-client.js', './js/sync-config.js', './js/theme.js', './js/ui.js', './js/vault.js',
  './js/academic/academic-migrations.js', './js/academic/academic-repository.js',
  './js/academic/artifact-schemas.js', './js/academic/backup-v2.js', './js/academic/project-model.js',
  './js/academic/relation-model.js', './js/academic/repository-helpers.js',
  './js/academic/source-model.js', './js/academic/source-repository.js',
  './js/academic/rubric-model.js', './js/academic/rubric-repository.js',
  './js/academic/evidence-model.js', './js/academic/evidence-repository.js',
  './js/academic/report-model.js', './js/academic/report-repository.js',
  './js/academic/presentation-model.js', './js/academic/presentation-repository.js',
  './js/projects/projects-controller.js', './js/projects/project-form.js', './js/projects/projects-view.js',
  './js/sources/sources-controller.js', './js/sources/source-form.js', './js/sources/sources-view.js',
  './js/rubrics/rubrics-controller.js', './js/rubrics/rubric-form.js', './js/rubrics/rubrics-view.js',
  './js/evidence/evidence-controller.js', './js/evidence/evidence-form.js',
  './js/evidence/evidence-labels.js', './js/evidence/evidence-view.js',
  './js/reports/reports-controller.js', './js/reports/report-shell.js', './js/reports/report-view.js',
  './js/presentations/presentations-controller.js', './js/presentations/presentation-shell.js',
  './js/presentations/presentation-view.js',
  './js/buenaventura/buenaventura-config.js', './js/buenaventura/buenaventura-context.js',
  './js/buenaventura/buenaventura-contracts.js', './js/buenaventura/buenaventura-controller.js',
  './js/buenaventura/buenaventura-orchestrator.js', './js/buenaventura/buenaventura-policy.js',
  './js/buenaventura/buenaventura-read-ports.js', './js/buenaventura/buenaventura-shell.js',
  './js/buenaventura/buenaventura-view.js',
  './js/buenaventura/providers/gemini-proxy-provider.js',
  './js/buenaventura/providers/provider-factory.js',
  './js/buenaventura/providers/provider-port.js',
  './js/buenaventura/providers/unavailable-provider.js',
  './js/buenaventura/relationship/identity-profile.js',
  './js/buenaventura/relationship/relationship-contracts.js',
  './js/buenaventura/relationship/relationship-policy.js',
  './js/buenaventura/relationship/relationship-store.js',
  './js/ux/ux-controller.js'
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
    let cacheWrite = Promise.resolve();
    const networkResponse = fetch(event.request).then(response => {
      if (response.ok) {
        const cacheCopy = response.clone();
        cacheWrite = caches.open(CACHE).then(cache => cache.put(event.request, cacheCopy));
      }
      return response;
    });
    event.waitUntil(networkResponse.then(() => cacheWrite).catch(() => {}));
    event.respondWith(networkResponse.catch(() =>
      caches.match(event.request, { ignoreSearch: true }).then(cached =>
        cached || (event.request.mode === 'navigate'
          ? caches.match('./index.html')
          : Promise.reject(new Error('offline')))
      )
    ));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
