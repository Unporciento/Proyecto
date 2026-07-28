import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('la interfaz usa CSS dedicado y expone Profesor Buenaventura por proyecto', async () => {
  const [html, projects, css] = await Promise.all([
    read('../index.html'),
    read('../js/projects/projects-view.js'),
    read('../css/buenaventura.css')
  ]);
  assert.match(html, /css\/buenaventura\.css/);
  assert.match(html, /js\/buenaventura\/buenaventura-controller\.js/);
  assert.match(projects, /data\.projectAction|buenaventura/);
  assert.match(css, /\.buenaventura-workspace/);
});

test('el envío externo exige divulgación y consentimiento nuevo por solicitud', async () => {
  const [shell, config, controller] = await Promise.all([
    read('../js/buenaventura/buenaventura-shell.js'),
    read('../js/buenaventura/buenaventura-config.js'),
    read('../js/buenaventura/buenaventura-controller.js')
  ]);
  assert.match(shell, /Google Gemini Free Tier/);
  assert.match(shell, /buenaventuraDeidentified/);
  assert.match(shell, /buenaventuraAdult/);
  assert.match(
    config,
    /https:\/\/forja-buenaventura-free\.informesinap937\.workers\.dev\/v1\/buenaventura\/recommend/
  );
  assert.match(controller, /function resetExternalConsent/);
  assert.match(controller, /finally \{[\s\S]*resetExternalConsent/);
});

test('el núcleo no importa repositorios académicos ni persistencia directa', async () => {
  const files = [
    'buenaventura-context.js', 'buenaventura-contracts.js',
    'buenaventura-controller.js', 'buenaventura-orchestrator.js',
    'buenaventura-policy.js', 'buenaventura-read-ports.js',
    'providers/gemini-proxy-provider.js', 'providers/provider-factory.js'
  ];
  for (const file of files) {
    const source = await read(`../js/buenaventura/${file}`);
    assert.doesNotMatch(
      source,
      /AcademicRepository|academic-repository|indexedDB|localStorage|sessionStorage/
    );
  }
  const controller = await read('../js/buenaventura/buenaventura-controller.js');
  assert.doesNotMatch(controller, /AcademicRepository|academic-repository|indexedDB/);
  const ports = await read('../js/buenaventura/buenaventura-read-ports.js');
  assert.match(ports, /'readonly'/);
  assert.doesNotMatch(ports, /'readwrite'/);
});

test('la evolución es opt-in y explica sus límites sin gamificación', async () => {
  const shell = await read('../js/buenaventura/buenaventura-shell.js');
  assert.match(shell, /buenaventuraEvolutionEnabled/);
  assert.match(shell, /no modifica permisos/i);
  assert.match(shell, /ni aumenta el acceso a datos/i);
  assert.match(shell, /no crea memoria de conversaciones/i);
  assert.match(shell, /no afecta notas, progreso ni funciones académicas/i);
  assert.match(shell, /desactivarla o eliminarla/i);
  assert.doesNotMatch(
    shell,
    /confeti|insignia|racha|coraz[oó]n|celebraci[oó]n|recompensa/i
  );
});

test('producción no expone controles de QA y conserva ambas etiquetas móviles', async () => {
  const [html, controller, policy] = await Promise.all([
    read('../index.html'),
    read('../js/buenaventura/buenaventura-controller.js'),
    read('../js/buenaventura/relationship/relationship-policy.js')
  ]);
  assert.match(html, /<meta name="mobile-web-app-capable" content="yes">/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  const production = `${html}\n${controller}\n${policy}`;
  assert.doesNotMatch(
    production,
    /URLSearchParams|location\.search|window\.__|globalThis\.__|forceTura|qaStage/i
  );
});
