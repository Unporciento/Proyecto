import { validateArtifact } from './artifact-schemas.js';
import { validateRelation } from './relation-model.js';

export const SOURCE_TYPES = Object.freeze([
  'pdf', 'word', 'image', 'website', 'book', 'article', 'note', 'video'
]);
export const FILE_SOURCE_TYPES = Object.freeze(['pdf', 'word', 'image']);

function fail(message) {
  throw new TypeError(`Fuente no válida: ${message}`);
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function makeSourceBundle(input, {
  existing = null,
  ids = {},
  now = new Date()
} = {}) {
  const timestamp = new Date(now).toISOString();
  const sourceId = existing?.source.id || ids.sourceId;
  if (!sourceId) fail('falta el identificador.');
  const documentId = clean(input.documentId) || null;
  if (FILE_SOURCE_TYPES.includes(input.sourceType) && !documentId) {
    fail('este tipo necesita un documento de la Biblioteca.');
  }
  const source = {
    id: sourceId,
    projectId: input.projectId,
    parentId: null,
    kind: 'source',
    title: clean(input.title).replace(/\s+/g, ' '),
    status: 'ready',
    position: existing?.source.position || 0,
    data: {
      sourceType: input.sourceType,
      description: clean(input.description),
      author: clean(input.author),
      date: clean(input.date) || null,
      url: clean(input.url),
      notes: clean(input.notes)
    },
    schemaVersion: 2,
    createdAt: existing?.source.createdAt || timestamp,
    updatedAt: timestamp
  };
  validateArtifact(source);
  if (!documentId) return { source, documentRef: null, relation: null };

  const reference = {
    id: existing?.reference?.id || ids.referenceId,
    projectId: source.projectId,
    parentId: null,
    kind: 'document_ref',
    title: `Archivo de ${source.title}`,
    status: 'ready',
    position: 0,
    data: { documentId, role: 'source_file' },
    schemaVersion: 1,
    createdAt: existing?.reference?.createdAt || timestamp,
    updatedAt: timestamp
  };
  if (!reference.id) fail('falta el identificador de referencia.');
  validateArtifact(reference);
  const relation = {
    id: existing?.relation?.id || ids.relationId,
    projectId: source.projectId,
    fromId: reference.id,
    toId: source.id,
    type: 'attached_to',
    note: '',
    schemaVersion: 1,
    createdAt: existing?.relation?.createdAt || timestamp
  };
  if (!relation.id) fail('falta el identificador de relación.');
  validateRelation(relation, reference, source);
  return { source, documentRef: reference, relation };
}

