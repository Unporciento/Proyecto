import {
  EVIDENCE_SCHEMA_VERSION,
  validateArtifact
} from './artifact-schemas.js';
import { validateRelationShape } from './relation-model.js';

export const EVIDENCE_TYPES = Object.freeze([
  'text', 'document', 'photo', 'technical_result',
  'procedure', 'finding', 'calculation', 'table_record'
]);
export const EVIDENCE_STATES = Object.freeze([
  'collected', 'review', 'approved', 'discarded'
]);
export const DOCUMENT_EVIDENCE_TYPES = Object.freeze(['document', 'photo']);

function fail(message) {
  throw new TypeError(`Evidencia no válida: ${message}`);
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueIds(values, label) {
  if (!Array.isArray(values)) fail(`${label} debe ser una lista.`);
  const cleaned = values.map(clean);
  if (cleaned.some(value => !value)) fail(`${label} contiene un identificador vacío.`);
  if (new Set(cleaned).size !== cleaned.length) fail(`${label} contiene relaciones duplicadas.`);
  return cleaned;
}

function relation(existing, ids, projectId, fromId, toId, type, now) {
  const key = `${type}:${fromId}:${toId}`;
  const record = {
    id: existing.get(key)?.id || ids(key),
    projectId,
    fromId,
    toId,
    type,
    note: '',
    schemaVersion: 1,
    createdAt: existing.get(key)?.createdAt || now
  };
  if (!record.id) fail('falta un identificador de relación.');
  validateRelationShape(record);
  return record;
}

export function makeEvidenceBundle(input, {
  existing = null,
  ids = () => null,
  now = new Date()
} = {}) {
  const timestamp = new Date(now).toISOString();
  const evidenceId = existing?.evidence.id || ids('evidence');
  if (!evidenceId) fail('falta el identificador.');
  const documentId = clean(input.documentId) || null;
  if (DOCUMENT_EVIDENCE_TYPES.includes(input.evidenceType) && !documentId) {
    fail('este tipo necesita un documento de la Biblioteca.');
  }
  const sourceIds = uniqueIds(input.sourceIds || [], 'sourceIds');
  const criterionIds = uniqueIds(input.criterionIds || [], 'criterionIds');
  if (!sourceIds.length) fail('selecciona al menos una fuente.');
  if (!criterionIds.length) fail('selecciona al menos un criterio.');
  const evidence = {
    id: evidenceId,
    projectId: input.projectId,
    parentId: null,
    kind: 'evidence',
    title: clean(input.title).replace(/\s+/g, ' '),
    status: 'ready',
    position: existing?.evidence.position || 0,
    data: {
      evidenceType: input.evidenceType,
      description: clean(input.description),
      observation: clean(input.observation),
      date: clean(input.date) || null,
      state: input.state
    },
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    createdAt: existing?.evidence.createdAt || timestamp,
    updatedAt: timestamp
  };
  validateArtifact(evidence);

  const oldRelations = new Map((existing?.relations || []).map(item => [
    `${item.type}:${item.fromId}:${item.toId}`, item
  ]));
  let documentRef = null;
  const relations = [];
  if (documentId) {
    documentRef = {
      id: existing?.documentRef?.id || ids('document_ref'),
      projectId: evidence.projectId,
      parentId: null,
      kind: 'document_ref',
      title: `Archivo de ${evidence.title}`,
      status: 'ready',
      position: 0,
      data: { documentId, role: 'evidence_file' },
      schemaVersion: 1,
      createdAt: existing?.documentRef?.createdAt || timestamp,
      updatedAt: timestamp
    };
    if (!documentRef.id) fail('falta el identificador de referencia.');
    validateArtifact(documentRef);
    relations.push(relation(
      oldRelations, ids, evidence.projectId,
      documentRef.id, evidence.id, 'attached_to', timestamp
    ));
  }
  sourceIds.forEach(sourceId => relations.push(relation(
    oldRelations, ids, evidence.projectId,
    evidence.id, sourceId, 'derived_from', timestamp
  )));
  criterionIds.forEach(criterionId => relations.push(relation(
    oldRelations, ids, evidence.projectId,
    evidence.id, criterionId, 'satisfies', timestamp
  )));
  return { evidence, documentRef, relations };
}
