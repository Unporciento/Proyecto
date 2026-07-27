import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('la identidad incluye metadatos, favicon, versión y año automático', async () => {
  const [html, controller] = await Promise.all([
    read('index.html'),
    read('js/ux/ux-controller.js')
  ]);
  assert.match(html, /rel="icon" href="assets\/icon\.svg"/);
  assert.match(html, /application-name" content="FORJA"/);
  assert.match(html, /id="copyrightYear"/);
  assert.match(html, /id="productVersion"/);
  assert.match(controller, /new Date\(\)\.getFullYear\(\)/);
  assert.match(controller, /FORJA_VERSION = '2\.0\.0'/);
});

test('la carga y el estado offline son breves, accesibles y no bloqueantes', async () => {
  const [html, css, controller] = await Promise.all([
    read('index.html'),
    read('css/ux.css'),
    read('js/ux/ux-controller.js')
  ]);
  assert.match(html, /appSplash" role="status"/);
  assert.match(html, /connectionBanner" role="status"/);
  assert.match(css, /splash-safety/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(controller, /navigator\.onLine/);
  assert.match(controller, /window\.addEventListener\('offline'/);
});

test('los errores globales muestran un mensaje seguro sin revelar datos', async () => {
  const controller = await read('js/ux/ux-controller.js');
  assert.match(controller, /unhandledrejection/);
  assert.match(controller, /Tus datos locales no fueron borrados/);
  assert.doesNotMatch(controller, /error\.message|error\.stack|fetch\(/);
});

test('404 y offline explican el estado y ofrecen recuperación clara', async () => {
  const [notFound, offline] = await Promise.all([read('404.html'), read('offline.html')]);
  assert.match(notFound, /Esta página no existe/);
  assert.match(notFound, /Volver a FORJA/);
  assert.match(offline, /Estás sin conexión/);
  assert.match(offline, /Intentar de nuevo/);
  assert.match(notFound + offline, /viewport-fit=cover/);
});

test('las microinteracciones respetan ahorro y movimiento reducido', async () => {
  const [ux, tokens] = await Promise.all([read('css/ux.css'), read('css/tokens.css')]);
  assert.match(ux, /prefers-reduced-motion/);
  assert.match(tokens, /data-energy="saver"/);
  assert.doesNotMatch(ux, /animation:\s*infinite/);
});
