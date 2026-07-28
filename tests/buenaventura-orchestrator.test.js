import test from 'node:test';
import assert from 'node:assert/strict';
import { BuenaventuraOrchestrator } from '../js/buenaventura/buenaventura-orchestrator.js';
import { UnavailableProvider } from '../js/buenaventura/providers/unavailable-provider.js';

function fragment(id) {
  return {
    schemaVersion: 'buenaventura-fragment-v1',
    module: 'rubric',
    kind: 'rubric_criterion',
    id,
    projectId: 'project_one',
    title: id,
    excerpt: 'Contenido verificable',
    provenance: { sourceType: 'academic_artifact', sourceId: id, label: `rubric: ${id}` },
    untrusted: true
  };
}

function request(fragments = [fragment('criterion_one')]) {
  return {
    schemaVersion: 'buenaventura-request-v1',
    requestId: 'request_one',
    task: 'compare',
    identityStage: 'professor_buenaventura',
    permissions: ['OBSERVE', 'RECOMMEND'],
    scope: {
      projectId: 'project_one',
      selectionIds: fragments.map(item => `${item.module}:${item.id}`)
    },
    fragments,
    constraints: { activeEvaluation: false, offline: false },
    consent: { externalProvider: false, deidentified: false, adultUse: false }
  };
}

class DeterministicProvider {
  constructor({ external = false, response = null } = {}) {
    this.external = external;
    this.calls = 0;
    this.response = response;
  }

  async recommend(value) {
    this.calls += 1;
    return this.response || {
      schemaVersion: 'buenaventura-response-v1',
      requestId: value.requestId,
      status: 'ok',
      text: 'El criterio y la evidencia coinciden parcialmente. Falta verificar la fuente.',
      references: value.fragments.map(item => ({
        fragmentId: item.id, module: item.module, id: item.id
      }))
    };
  }
}

test('UnavailableProvider es el valor predeterminado y conserva FORJA local', async () => {
  const orchestrator = new BuenaventuraOrchestrator();
  assert.ok(orchestrator.provider instanceof UnavailableProvider);
  const response = await orchestrator.recommend(request());
  assert.equal(response.status, 'provider_unavailable');
  assert.match(response.text, /funciones locales continúan disponibles/);
});

test('un proveedor externo no recibe contexto sin consentimiento específico', async () => {
  const provider = new DeterministicProvider({ external: true });
  const orchestrator = new BuenaventuraOrchestrator({ provider });
  const response = await orchestrator.recommend(request());
  assert.equal(response.status, 'policy_blocked');
  assert.equal(provider.calls, 0);
  const allowed = request([fragment('criterion_one')]);
  allowed.consent.externalProvider = true;
  allowed.consent.deidentified = true;
  allowed.consent.adultUse = true;
  assert.equal((await orchestrator.recommend(allowed)).status, 'ok');
  assert.equal(provider.calls, 1);
});

test('referencias ajenas y lenguaje contrario al canon se bloquean', async () => {
  const invalidReference = new DeterministicProvider({ response: {
    schemaVersion: 'buenaventura-response-v1',
    requestId: 'request_one',
    status: 'ok',
    text: 'La fuente disponible no basta para verificar esa afirmación.',
    references: [{ fragmentId: 'other', module: 'rubric', id: 'other' }]
  } });
  assert.equal((await new BuenaventuraOrchestrator({
    provider: invalidReference
  }).recommend(request())).status, 'policy_blocked');
  const invalidVoice = new DeterministicProvider({ response: {
    schemaVersion: 'buenaventura-response-v1',
    requestId: 'request_one',
    status: 'ok',
    text: 'Excelente, tú ya dominas todo. 🎉',
    references: []
  } });
  assert.equal((await new BuenaventuraOrchestrator({
    provider: invalidVoice
  }).recommend(request())).status, 'policy_blocked');
});
