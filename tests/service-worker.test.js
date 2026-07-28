import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadWorker({ fetchImpl, cachesImpl } = {}) {
  const source = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
  const listeners = {};
  const context = {
    URL, Error, Promise,
    location: { origin: 'https://unporciento.github.io' },
    fetch: fetchImpl || (async () => new Response('ok')),
    caches: cachesImpl || {
      open: async () => ({ addAll: async () => {}, put: async () => {} }),
      keys: async () => [],
      delete: async () => true,
      match: async () => null
    },
    self: {
      addEventListener: (name, handler) => { listeners[name] = handler; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} }
    }
  };
  vm.runInNewContext(source, context);
  return { listeners, source };
}

function dispatchFetch(listener, request) {
  let responsePromise;
  let lifecyclePromise;
  listener({
    request,
    respondWith(promise) { responsePromise = promise; },
    waitUntil(promise) { lifecyclePromise = promise; }
  });
  return { responsePromise, lifecyclePromise };
}

test('el service worker instala el shell versionado sin query strings repetidos', async () => {
  const added = [];
  const cachesImpl = {
    open: async () => ({
      addAll: async paths => { added.push(...paths); },
      put: async () => {}
    }),
    keys: async () => [],
    delete: async () => true,
    match: async () => null
  };
  const { listeners, source } = await loadWorker({ cachesImpl });
  const installEvent = { waitUntil(promise) { installEvent.work = promise; } };
  listeners.install(installEvent);
  await installEvent.work;

  assert.ok(added.length > 0);
  assert.ok(added.includes('./js/account-restore.js'));
  assert.ok(added.includes('./js/config.js'));
  assert.ok(added.includes('./js/academic/academic-migrations.js'));
  assert.ok(added.includes('./js/academic/backup-v2.js'));
  assert.ok(added.every(path => !path.includes('?v=')));
  assert.match(source, /forja-shell-\$\{RELEASE_VERSION\}/);
  assert.ok(added.includes('./404.html'));
  assert.ok(added.includes('./offline.html'));
  assert.ok(added.includes('./js/ux/ux-controller.js'));
  assert.ok(added.includes('./js/exam.js'));
  assert.ok(added.includes('./js/calibration.js'));
  assert.ok(added.includes('./js/evidence/evidence-labels.js'));
  assert.match(source, /RELEASE_VERSION = '2026\.07\.26-6'/);
});

test('clona la respuesta antes de que el original pueda consumirse', async () => {
  let releaseCache;
  const cacheReady = new Promise(resolve => { releaseCache = resolve; });
  let cachedBody = null;
  const request = {
    method: 'GET',
    mode: 'cors',
    url: 'https://unporciento.github.io/Proyecto/js/app.js'
  };
  const cachesImpl = {
    open: async () => {
      await cacheReady;
      return {
        put: async (_request, response) => { cachedBody = await response.text(); }
      };
    },
    keys: async () => [],
    delete: async () => true,
    match: async () => null
  };
  const { listeners } = await loadWorker({
    fetchImpl: async () => new Response('respuesta fresca'),
    cachesImpl
  });

  const pending = dispatchFetch(listeners.fetch, request);
  const original = await pending.responsePromise;
  assert.equal(await original.text(), 'respuesta fresca');
  releaseCache();
  await pending.lifecyclePromise;
  assert.equal(cachedBody, 'respuesta fresca');
});

test('no guarda en caché respuestas de red no exitosas', async () => {
  let openCalls = 0;
  const cachesImpl = {
    open: async () => {
      openCalls += 1;
      return { put: async () => {} };
    },
    keys: async () => [],
    delete: async () => true,
    match: async () => null
  };
  const { listeners } = await loadWorker({
    fetchImpl: async () => new Response('no disponible', { status: 503 }),
    cachesImpl
  });
  const pending = dispatchFetch(listeners.fetch, {
    method: 'GET',
    mode: 'cors',
    url: 'https://unporciento.github.io/Proyecto/api'
  });

  assert.equal((await pending.responsePromise).status, 503);
  await pending.lifecyclePromise;
  assert.equal(openCalls, 0);
});

test('usa el shell de la aplicación durante navegación offline', async () => {
  const cachesImpl = {
    open: async () => ({ put: async () => {} }),
    keys: async () => [],
    delete: async () => true,
    match: async key => key === './index.html' ? new Response('FORJA offline') : null
  };
  const { listeners } = await loadWorker({
    fetchImpl: async () => { throw new Error('offline'); },
    cachesImpl
  });
  const pending = dispatchFetch(listeners.fetch, {
    method: 'GET',
    mode: 'navigate',
    url: 'https://unporciento.github.io/Proyecto/biblioteca'
  });

  assert.equal(await (await pending.responsePromise).text(), 'FORJA offline');
  await pending.lifecyclePromise;
});

test('usa un recurso estático guardado cuando la red falla', async () => {
  const request = {
    method: 'GET',
    mode: 'cors',
    url: 'https://unporciento.github.io/Proyecto/css/app.css'
  };
  const cachesImpl = {
    open: async () => ({ put: async () => {} }),
    keys: async () => [],
    delete: async () => true,
    match: async key => key === request ? new Response('cached css') : null
  };
  const { listeners } = await loadWorker({
    fetchImpl: async () => { throw new Error('offline'); },
    cachesImpl
  });
  const pending = dispatchFetch(listeners.fetch, request);

  assert.equal(await (await pending.responsePromise).text(), 'cached css');
  await pending.lifecyclePromise;
});
