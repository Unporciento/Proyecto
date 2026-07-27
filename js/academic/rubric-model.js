import {
  RUBRIC_SCHEMA_VERSION,
  validateArtifact,
  validateArtifactParent
} from './artifact-schemas.js';

export const CRITERION_STATES = Object.freeze([
  'pending', 'in_progress', 'completed', 'not_applicable'
]);

function fail(message) {
  throw new TypeError(`Rúbrica no válida: ${message}`);
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function points(value) {
  if (value === '' || value === null || !Number.isFinite(Number(value))) {
    fail('el puntaje debe ser numérico.');
  }
  const result = Number(value);
  if (result < 0 || result > 1_000_000) fail('el puntaje está fuera de rango.');
  return result;
}

export function makeCriterion(input, {
  projectId,
  rubricId,
  existing = null,
  id,
  position = 0,
  now = new Date()
}) {
  const timestamp = new Date(now).toISOString();
  const criterion = {
    id: existing?.id || id,
    projectId,
    parentId: rubricId,
    kind: 'rubric_criterion',
    title: clean(input.title).replace(/\s+/g, ' '),
    status: 'ready',
    position,
    data: {
      description: clean(input.description),
      maxPoints: points(input.maxPoints),
      required: Boolean(input.required),
      state: input.state
    },
    schemaVersion: RUBRIC_SCHEMA_VERSION,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp
  };
  if (!criterion.id) fail('falta el identificador del criterio.');
  validateArtifact(criterion);
  return criterion;
}

export function makeRubricBundle(input, criteria, {
  projectId,
  existing = null,
  id,
  now = new Date()
}) {
  const timestamp = new Date(now).toISOString();
  const rubricId = existing?.id || id;
  if (!rubricId) fail('falta el identificador.');
  const normalized = criteria.map((criterion, position) => ({
    ...criterion,
    projectId,
    parentId: rubricId,
    position
  }));
  const rubric = {
    id: rubricId,
    projectId,
    parentId: null,
    kind: 'rubric',
    title: clean(input.title).replace(/\s+/g, ' '),
    status: 'ready',
    position: 0,
    data: {
      instructions: clean(input.instructions),
      observations: clean(input.observations),
      totalPoints: normalized.reduce((total, item) => total + item.data.maxPoints, 0)
    },
    schemaVersion: RUBRIC_SCHEMA_VERSION,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp
  };
  validateRubricBundle({ rubric, criteria: normalized });
  return { rubric, criteria: normalized };
}

export function validateRubricBundle(bundle) {
  validateArtifact(bundle.rubric);
  if (bundle.rubric.kind !== 'rubric') fail('el artefacto principal no es una rúbrica.');
  const titles = new Set();
  const ids = new Set();
  let total = 0;
  bundle.criteria.forEach((criterion, position) => {
    validateArtifact(criterion);
    validateArtifactParent(criterion, bundle.rubric);
    if (criterion.position !== position) fail('las posiciones no son consecutivas.');
    if (ids.has(criterion.id)) fail('hay identificadores de criterio duplicados.');
    ids.add(criterion.id);
    const title = criterion.title.normalize('NFKC').toLocaleLowerCase('es');
    if (titles.has(title)) fail('hay criterios duplicados.');
    titles.add(title);
    total += criterion.data.maxPoints;
  });
  if (Math.abs(total - bundle.rubric.data.totalPoints) > 1e-9) {
    fail('el puntaje total no coincide con los criterios.');
  }
  return true;
}
