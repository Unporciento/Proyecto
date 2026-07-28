import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('el Worker queda en workers.dev y no declara servicios con facturación', async () => {
  const config = await read('../buenaventura-proxy/wrangler.jsonc');
  assert.match(config, /"workers_dev": true/);
  assert.match(config, /"GEMINI_MODEL": "gemini-3\.5-flash-lite"/);
  assert.doesNotMatch(config, /"routes?"|"d1_databases"|"kv_namespaces"|"r2_buckets"/);
  assert.doesNotMatch(config, /durable_objects|queues|hyperdrive|paid/i);
  assert.doesNotMatch(config, /GEMINI_API_KEY/);
});

test('FORJA mantiene vacío el endpoint hasta la aprobación de activación', async () => {
  const config = await read('../js/buenaventura/buenaventura-config.js');
  assert.match(config, /BUENAVENTURA_PROXY_URL = ''/);
});
