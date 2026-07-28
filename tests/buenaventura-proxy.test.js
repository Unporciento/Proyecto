import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../buenaventura-proxy/src/index.js';

const origin = 'https://unporciento.github.io';
const env = {
  GEMINI_API_KEY: 'synthetic-secret',
  GEMINI_MODEL: 'gemini-3.5-flash-lite',
  ALLOWED_ORIGINS: origin
};

function payload() {
  return {
    schemaVersion: 'buenaventura-proxy-request-v1',
    task: 'compare',
    activeEvaluation: false,
    consent: { externalProvider: true, deidentified: true, adultUse: true },
    fragments: [{
      alias: 'F1',
      module: 'rubric',
      kind: 'rubric_criterion',
      excerpt: 'Criterio completamente sintético.'
    }]
  };
}

function post(value = payload(), requestOrigin = origin) {
  return new Request('https://proxy.example/v1/buenaventura/recommend', {
    method: 'POST',
    headers: { origin: requestOrigin, 'content-type': 'application/json' },
    body: JSON.stringify(value)
  });
}

test('bloquea orígenes ajenos antes de llamar al proveedor', async () => {
  const response = await worker.fetch(post(payload(), 'https://evil.example'), env);
  assert.equal(response.status, 403);
});

test('preflight limita CORS al origen y a POST', async () => {
  const request = new Request('https://proxy.example/v1/buenaventura/recommend', {
    method: 'OPTIONS',
    headers: { origin }
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
});

test('solo expone la ruta dedicada de Buenaventura', async () => {
  const request = new Request('https://proxy.example/otra-ruta', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(payload())
  });
  assert.equal((await worker.fetch(request, env)).status, 404);
});

test('exige consentimiento, desidentificación y uso adulto', async () => {
  const value = payload();
  value.consent.deidentified = false;
  const response = await worker.fetch(post(value), env);
  assert.equal(response.status, 400);
});

test('rechaza campos arbitrarios y caracteres de control', async () => {
  const extra = { ...payload(), projectId: 'no_debe_salir' };
  assert.equal((await worker.fetch(post(extra), env)).status, 400);
  const controlled = payload();
  controlled.fragments[0].excerpt = 'Texto\u0000oculto';
  assert.equal((await worker.fetch(post(controlled), env)).status, 400);
});

test('un JSON malformado es invalid_request y no simula una caída del proveedor', async t => {
  const provider = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('no debe llamar a Gemini');
  });
  const request = new Request('https://proxy.example/v1/buenaventura/recommend', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: '{invalid'
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid_request' });
  assert.equal(provider.mock.callCount(), 0);
});

test('fija Gemini Free y envía solo el contexto sintético permitido', async t => {
  let call;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    call = { url, body: JSON.parse(options.body), headers: options.headers };
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        status: 'ok',
        text: 'Observaciones: F1 es verificable. Recomendaciones: conservar el criterio.',
        references: ['F1']
      }) }] } }]
    }));
  });
  const response = await worker.fetch(post(), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(call.url, /gemini-3\.5-flash-lite:generateContent$/);
  assert.equal(call.headers['x-goog-api-key'], 'synthetic-secret');
  assert.deepEqual(JSON.parse(call.body.contents[0].parts[0].text), {
    task: 'compare',
    activeEvaluation: false,
    fragments: [{
      alias: 'F1', module: 'rubric', kind: 'rubric_criterion',
      excerpt: 'Criterio completamente sintético.'
    }]
  });
  assert.equal(call.body.generationConfig.maxOutputTokens, 800);
  assert.equal(body.schemaVersion, 'buenaventura-proxy-response-v1');
});

test('normaliza fallos de Gemini sin exponer mensajes del proveedor', async t => {
  const cases = [
    [400, 'INVALID_ARGUMENT', 'invalid_request'],
    [403, 'PERMISSION_DENIED', 'permission_denied'],
    [404, 'NOT_FOUND', 'model_not_found'],
    [429, 'RESOURCE_EXHAUSTED', 'quota_exhausted'],
    [503, 'UNAVAILABLE', 'provider_unavailable']
  ];
  let index = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    const [status, providerType] = cases[index];
    return new Response(JSON.stringify({
      error: { status: providerType, message: 'mensaje que no debe salir' }
    }), { status, headers: { 'content-type': 'application/json' } });
  });
  for (index = 0; index < cases.length; index += 1) {
    const [status, , category] = cases[index];
    const response = await worker.fetch(post(), env);
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: category });
  }
});
