import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('la fuente final enlaza el estado técnico vigente', async () => {
  const [readme, certification, versioning] = await Promise.all([
    read('README.md'),
    read('docs/FORJA-TECHNICAL-CERTIFICATION.md'),
    read('docs/VERSIONING.md')
  ]);
  assert.match(readme, /FORJA-TECHNICAL-CERTIFICATION\.md/);
  assert.match(certification, /IndexedDB permanece en versión 3/);
  assert.match(certification, /respaldo en versión 2/);
  assert.match(certification, /Service Worker es `2026\.07\.28-11`/);
  assert.match(versioning, /\| Service Worker \| `2026\.07\.28-11` \|/);
});

test('la certificación conserva proveedor gratuito, límites y degradación', async () => {
  const certification = await read('docs/FORJA-TECHNICAL-CERTIFICATION.md');
  assert.match(certification, /gemini-3\.5-flash-lite/);
  assert.match(certification, /Cloudflare Workers Free/);
  assert.match(certification, /15 RPM, 250\.000 TPM y 500 RPD/);
  assert.match(certification, /No hay modelo alternativo, proveedor alternativo ni fallback pagado/);
  assert.match(certification, /`provider_unavailable`/);
});

test('las validaciones físicas permanecen pendientes y no se certifican por emulación', async () => {
  const certification = await read('docs/FORJA-TECHNICAL-CERTIFICATION.md');
  for (const pending of [
    'Safari en iPhone real',
    'PWA instalada en iPhone',
    'Medición física de batería',
    'Revisión visual de paletas claras'
  ]) {
    assert.match(certification, new RegExp(`- \\[ \\] ${pending}`));
    assert.doesNotMatch(certification, new RegExp(`- \\[x\\] ${pending}`));
  }
  assert.match(certification, /Chrome no sustituye una prueba física|pendiente físico|dispositivo real/i);
});

test('el cierre excluye funciones y líneas de trabajo pospuestas', async () => {
  const certification = await read('docs/FORJA-TECHNICAL-CERTIFICATION.md');
  assert.match(certification, /### Pospuesto/);
  for (const item of [
    'Carga diferida',
    'Sincronización remota',
    'Laboratorio',
    'NEXUS',
    'Nuevos proveedores'
  ]) assert.match(certification, new RegExp(`- ${item}`));
});
