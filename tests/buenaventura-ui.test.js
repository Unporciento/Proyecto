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
  assert.match(config, /BUENAVENTURA_PROXY_URL = ''/);
  assert.match(controller, /function resetExternalConsent/);
  assert.match(controller, /finally \{[\s\S]*resetExternalConsent/);
});

test('el módulo no importa repositorios de escritura ni APIs de persistencia', async () => {
  const files = [
    'buenaventura-context.js', 'buenaventura-contracts.js',
    'buenaventura-controller.js', 'buenaventura-orchestrator.js',
    'buenaventura-policy.js', 'buenaventura-read-ports.js',
    'providers/gemini-proxy-provider.js', 'providers/provider-factory.js'
  ];
  for (const file of files) {
    const source = await read(`../js/buenaventura/${file}`);
    assert.doesNotMatch(source, /AcademicRepository|localStorage|sessionStorage/);
    assert.doesNotMatch(source, /\.(put|add|delete|clear)\s*\(/);
  }
  const ports = await read('../js/buenaventura/buenaventura-read-ports.js');
  assert.match(ports, /'readonly'/);
  assert.doesNotMatch(ports, /'readwrite'/);
});
