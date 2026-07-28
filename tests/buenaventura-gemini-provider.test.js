import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiProxyProvider } from '../js/buenaventura/providers/gemini-proxy-provider.js';
import { createBuenaventuraProvider } from '../js/buenaventura/providers/provider-factory.js';
import { UnavailableProvider } from '../js/buenaventura/providers/unavailable-provider.js';

function request() {
  return {
    schemaVersion: 'buenaventura-request-v1',
    requestId: 'request_one',
    task: 'compare',
    permissions: ['OBSERVE', 'RECOMMEND'],
    scope: { projectId: 'project_one', selectionIds: ['rubric:criterion_one'] },
    fragments: [{
      schemaVersion: 'buenaventura-fragment-v1',
      module: 'rubric',
      kind: 'rubric_criterion',
      id: 'criterion_one',
      projectId: 'project_one',
      title: 'Criterio uno',
      excerpt: 'Contenido verificable',
      provenance: {
        sourceType: 'academic_artifact',
        sourceId: 'criterion_one',
        label: 'Rúbrica: criterio uno'
      },
      untrusted: true
    }],
    constraints: { activeEvaluation: false, offline: false },
    consent: { externalProvider: false, deidentified: false, adultUse: false }
  };
}

test('sin endpoint conserva UnavailableProvider como respaldo', () => {
  assert.ok(createBuenaventuraProvider({ endpoint: '' }) instanceof UnavailableProvider);
});

test('envía al proxy solo aliases, tarea, contexto mínimo y consentimiento', async () => {
  let outbound;
  const provider = new GeminiProxyProvider({
    endpoint: 'https://proxy.example/recommend',
    fetchImpl: async (_url, options) => {
      outbound = { ...options, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({
        schemaVersion: 'buenaventura-proxy-response-v1',
        status: 'ok',
        text: 'Observaciones: coincidencia parcial. Recomendaciones: verificar F1.',
        references: ['F1']
      }));
    }
  });
  const value = request();
  value.consent = { externalProvider: true, deidentified: true, adultUse: true };
  const response = await provider.recommend(value);

  assert.equal(outbound.credentials, 'omit');
  assert.equal(outbound.cache, 'no-store');
  assert.deepEqual(Object.keys(outbound.body).sort(), [
    'activeEvaluation', 'consent', 'fragments', 'schemaVersion', 'task'
  ]);
  assert.deepEqual(outbound.body.fragments[0], {
    alias: 'F1',
    module: 'rubric',
    kind: 'rubric_criterion',
    excerpt: 'Contenido verificable'
  });
  assert.doesNotMatch(JSON.stringify(outbound.body), /project_one|criterion_one|request_one/);
  assert.equal(response.requestId, 'request_one');
  assert.deepEqual(response.references, [{
    fragmentId: 'criterion_one', module: 'rubric', id: 'criterion_one'
  }]);
});

test('rechaza referencias del proxy que no pertenecen a la selección', async () => {
  const provider = new GeminiProxyProvider({
    endpoint: 'https://proxy.example/recommend',
    fetchImpl: async () => new Response(JSON.stringify({
      schemaVersion: 'buenaventura-proxy-response-v1',
      status: 'ok',
      text: 'Observaciones y recomendaciones.',
      references: ['F4']
    }))
  });
  await assert.rejects(() => provider.recommend(request()), /Referencia externa/);
});
