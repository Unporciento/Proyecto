import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  defaultRelationship,
  validateRelationship
} from '../js/buenaventura/relationship/relationship-contracts.js';
import {
  observeAutonomy,
  setEvolutionEnabled
} from '../js/buenaventura/relationship/relationship-policy.js';
import {
  identityProfile,
  transitionMessage
} from '../js/buenaventura/relationship/identity-profile.js';

function enabled() {
  return setEvolutionEnabled(defaultRelationship(), true);
}

function observe(relationship, family, task, day, overrides = {}) {
  return observeAutonomy(relationship, {
    family,
    task,
    day,
    actionComplete: true,
    activeEvaluation: false,
    technicalError: false,
    ...overrides
  });
}

test('el estado inicial es global, opt-in y no contiene marcador numérico', () => {
  const state = defaultRelationship();
  assert.equal(state.evolutionEnabled, false);
  assert.equal(state.stage, 'professor_buenaventura');
  assert.deepEqual(state.milestoneEvidence, {
    families: [],
    separatedSessions: false,
    taskKinds: [],
    lastObservationDay: null
  });
  assert.doesNotMatch(JSON.stringify(state), /score|points|percent|weight|count|message/i);
  assert.equal(validateRelationship(state).stage, 'professor_buenaventura');
});

test('la política usa predicados cualitativos y avanza exactamente una etapa', () => {
  let state = enabled();
  state = observe(state, 'attempt_before_help', 'explain', '2026-07-01').relationship;
  state = observe(state, 'reasoning_articulated', 'review', '2026-07-01').relationship;
  const first = observe(state, 'source_verified', 'compare', '2026-07-02');
  assert.equal(first.transition.from, 'professor_buenaventura');
  assert.equal(first.transition.to, 'buenaventura');
  assert.equal(first.relationship.stage, 'buenaventura');
  assert.deepEqual(first.relationship.milestoneEvidence.families, []);

  state = observe(
    first.relationship, 'revision_after_feedback', 'review', '2026-07-03'
  ).relationship;
  state = observe(state, 'decision_justified', 'compare', '2026-07-03').relationship;
  const second = observe(state, 'evidence_connected', 'suggest', '2026-07-04');
  assert.equal(second.transition.to, 'professor_tura');
  assert.equal(second.relationship.stage, 'professor_tura');

  state = observe(
    second.relationship, 'attempt_before_help', 'explain', '2026-07-05'
  ).relationship;
  state = observe(state, 'reasoning_articulated', 'review', '2026-07-05').relationship;
  state = observe(state, 'revision_after_feedback', 'compare', '2026-07-05').relationship;
  state = observe(state, 'decision_justified', 'suggest', '2026-07-05').relationship;
  const final = observe(state, 'source_verified', 'question', '2026-07-06');
  assert.equal(final.transition.to, 'tura');
  assert.equal(final.relationship.stage, 'tura');
  assert.equal(observe(final.relationship, 'source_verified', 'review', '2026-07-07')
    .transition, null);
});

test('una acción aislada, evaluación, error, mala nota o ausencia no cambian etapa', () => {
  const state = enabled();
  const isolated = observe(state, 'attempt_before_help', 'explain', '2026-07-01');
  assert.equal(isolated.relationship.stage, 'professor_buenaventura');
  assert.equal(observe(state, 'source_verified', 'compare', '2026-07-02', {
    activeEvaluation: true
  }).relationship.stage, 'professor_buenaventura');
  assert.equal(observe(state, 'source_verified', 'compare', '2026-07-02', {
    technicalError: true
  }).relationship.stage, 'professor_buenaventura');
  assert.equal(observe(state, 'revision_after_feedback', 'review', '2026-07-02', {
    actionComplete: false,
    grade: 'mala'
  }).relationship.stage, 'professor_buenaventura');
  const afterAbsence = observe(
    isolated.relationship,
    'reasoning_articulated',
    'review',
    '2027-07-01'
  );
  assert.equal(afterAbsence.relationship.stage, 'professor_buenaventura');
  assert.equal(validateRelationship(state).stage, 'professor_buenaventura');
});

test('desactivar congela la etapa y nunca concede progreso por tiempo', () => {
  const advanced = {
    ...enabled(),
    stage: 'buenaventura'
  };
  const disabled = setEvolutionEnabled(advanced, false);
  const result = observe(disabled, 'source_verified', 'compare', '2030-01-01');
  assert.equal(result.relationship.stage, 'buenaventura');
  assert.deepEqual(result.relationship.milestoneEvidence, disabled.milestoneEvidence);
});

test('las cuatro voces son pequeñas, sobrias y conservan usted en la política común', async () => {
  const expected = [
    ['professor_buenaventura', 'Profesor Buenaventura', 'formal y algo más explicativo'],
    ['buenaventura', 'Buenaventura', 'formal, directo y ligeramente más conciso'],
    ['professor_tura', 'Profesor Tura', 'institucional, sobrio y más sintético'],
    ['tura', 'Tura', 'sobrio, directo y conciso']
  ];
  for (const [stage, name, voice] of expected) {
    assert.deepEqual(identityProfile(stage), { name, voice });
    assert.match(transitionMessage(stage), /permisos no cambian/);
    assert.doesNotMatch(transitionMessage(stage), /logro|premio|amistad|felicit/i);
  }
  const worker = await readFile(
    new URL('../buenaventura-proxy/src/index.js', import.meta.url),
    'utf8'
  );
  assert.match(worker, /Siempre trate a la persona de usted/);
  assert.match(worker, /No simule amistad, afecto, dependencia/);
});

test('contrato y política no implementan puntuación, suma ni contadores ocultos', async () => {
  const [contract, policy] = await Promise.all([
    readFile(
      new URL(
        '../js/buenaventura/relationship/relationship-contracts.js',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL(
        '../js/buenaventura/relationship/relationship-policy.js',
        import.meta.url
      ),
      'utf8'
    )
  ]);
  assert.doesNotMatch(
    `${contract}\n${policy}`,
    /\b(score|points?|percentage|percent|weights?|messageCount|successCount)\b/i
  );
  assert.doesNotMatch(policy, /\.reduce\s*\(|\+\+|--|\+=|sum\s*\(/);
});
