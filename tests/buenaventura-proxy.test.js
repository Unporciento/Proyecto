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

test('agotamiento de cuota degrada sin respuesta académica ni fallback', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(
    JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } }),
    { status: 429, headers: { 'content-type': 'application/json' } }
  ));
  const response = await worker.fetch(post(), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'provider_unavailable' });
});
