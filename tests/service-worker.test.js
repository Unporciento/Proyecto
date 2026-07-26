import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('el service worker instala el shell versionado sin query strings repetidos', async () => {
  const source = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
  const listeners = {};
  const added = [];
  let skipped = false;
  const cache = {
    addAll: async paths => { added.push(...paths); },
    put: async () => {}
  };
  const context = {
    URL, Error, Promise,
    location: { origin: 'https://unporciento.github.io' },
    fetch: async () => new Response('ok'),
    caches: {
      open: async () => cache,
      keys: async () => [],
      delete: async () => true,
      match: async () => null
    },
    self: {
      addEventListener: (name, handler) => { listeners[name] = handler; },
      skipWaiting: async () => { skipped = true; },
      clients: { claim: async () => {} }
    }
  };
  vm.runInNewContext(source, context);
  let installWork;
  listeners.install({ waitUntil: promise => { installWork = promise; } });
  await installWork;

  assert.equal(skipped, true);
  assert.ok(added.includes('./js/account-restore.js'));
  assert.ok(added.includes('./js/config.js'));
  assert.ok(added.every(path => !path.includes('?v=')));
  assert.match(source, /forja-shell-\$\{RELEASE_VERSION\}/);
});
