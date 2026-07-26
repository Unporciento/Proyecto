export const RELATION_SCHEMA_VERSION = 1;

const ALLOWED = new Map([
  ['attached_to', new Set(['document_ref:source', 'document_ref:evidence'])],
  ['derived_from', new Set(['evidence:source', 'evidence:document_ref', 'report_section:evidence'])],
  ['supports', new Set(['evidence:report_section'])],
  ['satisfies', new Set(['evidence:rubric_criterion', 'report_section:rubric_criterion'])],
  ['cites', new Set(['report_section:source'])]
]);

function fail(message) {
  throw new TypeError(`Relación no válida: ${message}`);
}

function text(value, label, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    fail(`${label} es incorrecto.`);
  }
}

export function relationKey(relation) {
  return [relation.projectId, relation.fromId, relation.toId, relation.type].join('\u001f');
}

export function validateRelationShape(relation) {
  if (!relation || Object.getPrototypeOf(relation) !== Object.prototype) fail('debe ser un objeto simple.');
  const keys = ['id', 'projectId', 'fromId', 'toId', 'type', 'note', 'schemaVersion', 'createdAt'].sort();
  const actual = Object.keys(relation).sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    fail('contiene campos ausentes o no reconocidos.');
  }
  text(relation.id, 'id', 120);
  text(relation.projectId, 'projectId', 120);
  text(relation.fromId, 'fromId', 120);
  text(relation.toId, 'toId', 120);
  text(relation.type, 'type', 40);
  text(relation.note, 'note', 2_000, false);
  if (relation.schemaVersion !== RELATION_SCHEMA_VERSION) fail('schemaVersion no es compatible.');
  if (typeof relation.createdAt !== 'string' || !Number.isFinite(Date.parse(relation.createdAt))) {
    fail('createdAt es incorrecto.');
  }
  if (relation.fromId === relation.toId) fail('no se permiten autorrelaciones.');
  return true;
}

export function validateRelation(relation, fromArtifact, toArtifact) {
  validateRelationShape(relation);
  if (!fromArtifact || !toArtifact) fail('algún extremo no existe.');
  if (fromArtifact.projectId !== relation.projectId || toArtifact.projectId !== relation.projectId) {
    fail('los extremos deben pertenecer al mismo proyecto.');
  }
  const pair = `${fromArtifact.kind}:${toArtifact.kind}`;
  if (!ALLOWED.get(relation.type)?.has(pair)) {
    fail(`${relation.type} no permite ${pair}.`);
  }
  return true;
}

