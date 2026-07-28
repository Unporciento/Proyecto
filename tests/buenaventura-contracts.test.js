import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FRAGMENT_CHARS,
  validateRequest,
  validateResponse
} from '../js/buenaventura/buenaventura-contracts.js';

function fragment(id, module = 'rubric', projectId = 'project_one') {
  return {
    schemaVersion: 'buenaventura-fragment-v1',
    module,
    kind: module === 'rubric' ? 'rubric_criterion' : 'evidence',
    id,
    projectId,
    title: id,
    excerpt: 'Contenido verificable',
    provenance: { sourceType: 'academic_artifact', sourceId: id, label: `${module}: ${id}` },
    untrusted: true
  };
}

function request(fragments = [fragment('criterion_one')]) {
  return {
    schemaVersion: 'buenaventura-request-v1',
    requestId: 'request_one',
    task: 'compare',
    permissions: ['OBSERVE', 'RECOMMEND'],
    scope: {
      projectId: 'project_one',
      selectionIds: fragments.map(item => `${item.module}:${item.id}`)
    },
    fragments,
    constraints: { activeEvaluation: false, offline: false },
    consent: { externalProvider: false }
  };
}

test('BuenaventuraRequestV1 admite compare con módulos distintos del mismo proyecto', () => {
  const value = request([
    fragment('criterion_one', 'rubric'),
    fragment('evidence_one', 'evidence'),
    fragment('section_one', 'report')
  ]);
  assert.equal(validateRequest(value), true);
  assert.equal('module' in value, false);
});

test('BuenaventuraRequestV1 rechaza cruces de proyecto, campos y permisos adicionales', () => {
  assert.throws(() => validateRequest(request([
    fragment('criterion_one'),
    fragment('evidence_two', 'evidence', 'project_two')
  ])), /mismo proyecto|proyecto solicitado/);
  assert.throws(() => validateRequest({ ...request(), mutation: 'save' }), /campos/);
  assert.throws(() => validateRequest({
    ...request(), permissions: ['OBSERVE', 'RECOMMEND', 'WRITE']
  }), /permissions/);
});

test('los presupuestos son cuatro fragmentos, 2.000 por fragmento y 8.000 totales', () => {
  const fragments = [1, 2, 3, 4].map(index => ({
    ...fragment(`item_${index}`),
    excerpt: 'x'.repeat(MAX_FRAGMENT_CHARS)
  }));
  assert.equal(validateRequest(request(fragments)), true);
  assert.throws(() => validateRequest(request([
    ...fragments, fragment('item_5')
  ])), /uno y cuatro|selectionIds/);
  assert.throws(() => validateRequest(request([{
    ...fragment('large'), excerpt: 'x'.repeat(MAX_FRAGMENT_CHARS + 1)
  }])), /excerpt/);
});

test('BuenaventuraResponseV1 no admite campos de mutación ni referencias ajenas', () => {
  const response = {
    schemaVersion: 'buenaventura-response-v1',
    requestId: 'request_one',
    status: 'ok',
    text: 'La evidencia respalda una parte del criterio; falta verificar el alcance.',
    references: [{ fragmentId: 'evidence_one', module: 'evidence', id: 'evidence_one' }]
  };
  assert.equal(validateResponse(response), true);
  assert.throws(() => validateResponse({ ...response, operations: [] }), /campos/);
});

export { fragment, request };
