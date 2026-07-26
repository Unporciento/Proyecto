import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

test('los imports locales existen y no usan versiones manuales repetidas', async () => {
  const files = (await readdir(resolve(root, 'js'))).filter(name => name.endsWith('.js'));
  for (const name of files) {
    const source = await readFile(resolve(root, 'js', name), 'utf8');
    assert.doesNotMatch(source, /\?v=/, `${name} conserva un query de versión manual`);
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      await access(resolve(root, 'js', match[1]));
    }
  }
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /\?v=/);
});

test('la CSP prepara un único origen de sincronización sin comodines', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const policy = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
  const connect = policy.match(/connect-src ([^;]+)/)?.[1] || '';
  assert.match(connect, /https:\/\/forja-sync\.invalid/);
  assert.doesNotMatch(connect, /\*/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /base-uri 'none'/);
});
