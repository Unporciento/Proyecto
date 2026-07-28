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

const channel = value => {
  const component = value / 255;
  return component <= .04045 ? component / 12.92 : ((component + .055) / 1.055) ** 2.4;
};

const luminance = hex => {
  const parts = hex.match(/[a-f\d]{2}/gi).map(value => channel(Number.parseInt(value, 16)));
  return .2126 * parts[0] + .7152 * parts[1] + .0722 * parts[2];
};

const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};

test('la paleta clara conserva contraste AA en texto y controles', async () => {
  const tokens = await read('css/tokens.css');
  const lightBlocks = [
    tokens.match(/:root\[data-theme="light"\]\s*\{([^}]+)\}/)?.[1],
    tokens.match(/:root:not\(\[data-theme\]\)\s*\{([^}]+)\}/)?.[1]
  ];
  for (const block of lightBlocks) {
    assert.ok(block);
    const value = name => block.match(new RegExp(`--${name}:\\s*(#[a-f\\d]{6})`, 'i'))?.[1];
    assert.ok(contrast(value('muted-2'), '#ffffff') >= 4.5);
    assert.ok(contrast(value('accent'), '#ffffff') >= 4.5);
    assert.ok(contrast(value('accent-2'), '#ffffff') >= 4.5);
    assert.ok(contrast(value('accent-contrast'), value('accent')) >= 4.5);
  }
});

test('la marca y el perfil mantienen nombre visible y accesible coherentes', async () => {
  const [html, profile] = await Promise.all([read('index.html'), read('js/profile.js')]);
  assert.match(html, /<a class="brand" href="#inicio" data-go="inicio">/);
  assert.match(html, /id="profileBtn" aria-label="Abrir perfil local"><span aria-hidden="true">YO<\/span>/);
  assert.match(profile, /button\.setAttribute\('aria-label', `Abrir perfil local de \$\{name\}`\)/);
  assert.match(profile, /fallbackNode\.setAttribute\('aria-hidden', 'true'\)/);
});

test('los diálogos y Buenaventura resisten teclado virtual, orientación y texto ampliado', async () => {
  const [responsive, buenaventura] = await Promise.all([
    read('css/responsive.css'),
    read('css/buenaventura.css')
  ]);
  assert.match(responsive, /dialog \.modal-card,\s*dialog \.focus-modal\s*\{[^}]*max-height:\s*calc\(100dvh - 28px\);[^}]*overflow-y:\s*auto;/s);
  assert.match(buenaventura, /\.buenaventura-intro h1\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
});
