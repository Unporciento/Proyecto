import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(root, '..');

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  }));
  return nested.flat();
}

test('los imports locales existen y no usan versiones manuales repetidas', async () => {
  const files = await javascriptFiles(resolve(projectRoot, 'js'));
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /\?v=/, `${file} conserva un query de versión manual`);
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      await access(resolve(dirname(file), match[1]));
    }
  }
  const html = await readFile(resolve(projectRoot, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /\?v=/);
  for (const match of html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)) {
    await access(resolve(projectRoot, match[1]));
  }
});

test('la CSP prepara un único origen de sincronización sin comodines', async () => {
  const html = await readFile(resolve(projectRoot, 'index.html'), 'utf8');
  const policy = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
  const connect = policy.match(/connect-src ([^;]+)/)?.[1] || '';
  assert.match(connect, /https:\/\/forja-sync\.invalid/);
  assert.doesNotMatch(connect, /\*/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /base-uri 'none'/);
});
