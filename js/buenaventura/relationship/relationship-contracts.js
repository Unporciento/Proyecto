export const RELATIONSHIP_SETTING_KEY = 'buenaventuraRelationship';
export const RELATIONSHIP_SCHEMA = 'buenaventura-relationship-v1';
export const IDENTITY_STAGES = Object.freeze([
  'professor_buenaventura',
  'buenaventura',
  'professor_tura',
  'tura'
]);
export const AUTONOMY_FAMILIES = Object.freeze([
  'attempt_before_help',
  'reasoning_articulated',
  'source_verified',
  'evidence_connected',
  'revision_after_feedback',
  'decision_justified'
]);
export const RELATIONSHIP_TASKS = Object.freeze([
  'explain', 'review', 'compare', 'suggest', 'question'
]);

function fail(message) {
  throw new TypeError(`Estado de relación no válido: ${message}`);
}

function plain(value) {
  return value !== null && typeof value === 'object'
    && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exact(value, keys, label) {
  if (!plain(value)) fail(`${label} debe ser un objeto simple.`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) {
    fail(`${label} contiene campos ausentes o desconocidos.`);
  }
}

function closedList(value, allowed, label) {
  if (!Array.isArray(value) || value.some(item => !allowed.includes(item))) {
    fail(`${label} contiene valores desconocidos.`);
  }
  if (new Set(value).size !== value.length) fail(`${label} contiene duplicados.`);
}

function validDay(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function emptyMilestoneEvidence(lastObservationDay = null) {
  return {
    families: [],
    separatedSessions: false,
    taskKinds: [],
    lastObservationDay
  };
}

export function defaultRelationship() {
  return {
    schemaVersion: RELATIONSHIP_SCHEMA,
    evolutionEnabled: false,
    stage: 'professor_buenaventura',
    milestoneEvidence: emptyMilestoneEvidence()
  };
}

export function validateRelationship(value) {
  exact(value, [
    'schemaVersion', 'evolutionEnabled', 'stage', 'milestoneEvidence'
  ], 'relationship');
  if (value.schemaVersion !== RELATIONSHIP_SCHEMA) fail('schemaVersion es incompatible.');
  if (typeof value.evolutionEnabled !== 'boolean') fail('evolutionEnabled es incorrecto.');
  if (!IDENTITY_STAGES.includes(value.stage)) fail('stage es desconocido o imposible.');
  exact(value.milestoneEvidence, [
    'families', 'separatedSessions', 'taskKinds', 'lastObservationDay'
  ], 'milestoneEvidence');
  closedList(value.milestoneEvidence.families, AUTONOMY_FAMILIES, 'families');
  closedList(value.milestoneEvidence.taskKinds, RELATIONSHIP_TASKS, 'taskKinds');
  if (typeof value.milestoneEvidence.separatedSessions !== 'boolean') {
    fail('separatedSessions es incorrecto.');
  }
  if (!validDay(value.milestoneEvidence.lastObservationDay)) {
    fail('lastObservationDay es inválido.');
  }
  return structuredClone(value);
}
