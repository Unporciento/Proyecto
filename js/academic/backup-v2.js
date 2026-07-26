import {
  validateArtifact,
  validateArtifactParent
} from './artifact-schemas.js';
import { validateProject } from './project-model.js';
import {
  relationKey,
  validateRelation
} from './relation-model.js';

export const BACKUP_SCHEMA_VERSION = 2;

const LIMITS = Object.freeze({
  academicProjects: 2_000,
  projectArtifacts: 100_000,
  artifactRelations: 250_000,
  artifactRevisions: 20_000
});

function fail(message) {
  throw new Error(`Respaldo no válido: ${message}`);
}

function plain(value) {
  return value !== null && typeof value === 'object' &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function rows(raw, name) {
  const values = raw[name];
  if (!Array.isArray(values)) fail(`falta la colección ${name}.`);
  if (values.length > LIMITS[name]) fail(`${name} supera el límite permitido.`);
  return values;
}

function uniqueIds(values, label) {
  const ids = new Set();
  for (const value of values) {
    if (ids.has(value.id)) fail(`${label} contiene identificadores duplicados.`);
    ids.add(value.id);
  }
  return ids;
}

function validateRevision(revision, artifactMap, projectIds) {
  if (!plain(revision)) fail('hay una revisión incorrecta.');
  const expected = [
    'id', 'artifactId', 'projectId', 'revision', 'snapshot',
    'reason', 'schemaVersion', 'createdAt'
  ].sort();
  const actual = Object.keys(revision).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail('hay una revisión con campos no reconocidos.');
  }
  if (revision.schemaVersion !== 1) fail('hay una revisión con versión incompatible.');
  if (!Number.isSafeInteger(revision.revision) || revision.revision < 1) fail('hay una revisión incorrecta.');
  if (!['manual', 'submitted', 'restored'].includes(revision.reason)) fail('hay una razón de revisión incorrecta.');
  if (typeof revision.createdAt !== 'string' || !Number.isFinite(Date.parse(revision.createdAt))) {
    fail('hay una fecha de revisión incorrecta.');
  }
  const artifact = artifactMap.get(revision.artifactId);
  if (!artifact || artifact.projectId !== revision.projectId || !projectIds.has(revision.projectId)) {
    fail('hay una revisión huérfana.');
  }
  validateArtifact(revision.snapshot);
  if (revision.snapshot.id !== revision.artifactId) fail('hay una revisión de otro artefacto.');
}

export function upgradeBackupV1(validatedV1) {
  const upgraded = clone(validatedV1);
  upgraded.version = BACKUP_SCHEMA_VERSION;
  for (const name of Object.keys(LIMITS)) upgraded[name] = [];
  return upgraded;
}

export function validateBackupV2(raw, validateLegacy) {
  if (!plain(raw) || raw.version !== BACKUP_SCHEMA_VERSION) fail('la versión no es compatible.');
  const legacy = validateLegacy({ ...raw, version: 1 });
  const projects = rows(raw, 'academicProjects');
  const artifacts = rows(raw, 'projectArtifacts');
  const relations = rows(raw, 'artifactRelations');
  const revisions = rows(raw, 'artifactRevisions');
  const subjectIds = new Set(legacy.subjects.map(item => item.id));
  const documentIds = new Set(legacy.documents.map(item => item.id));

  const projectIds = uniqueIds(projects, 'academicProjects');
  for (const project of projects) {
    validateProject(project);
    if (!subjectIds.has(project.subjectId)) fail('hay un proyecto sin asignatura.');
  }

  uniqueIds(artifacts, 'projectArtifacts');
  const artifactMap = new Map();
  for (const artifact of artifacts) {
    validateArtifact(artifact);
    if (!projectIds.has(artifact.projectId)) fail('hay un artefacto sin proyecto.');
    if (artifact.kind === 'document_ref' && !documentIds.has(artifact.data.documentId)) {
      fail('hay una referencia a un documento inexistente.');
    }
    artifactMap.set(artifact.id, artifact);
  }
  for (const artifact of artifacts) {
    validateArtifactParent(artifact, artifact.parentId ? artifactMap.get(artifact.parentId) : null);
  }

  uniqueIds(relations, 'artifactRelations');
  const relationKeys = new Set();
  for (const relation of relations) {
    validateRelation(relation, artifactMap.get(relation.fromId), artifactMap.get(relation.toId));
    const key = relationKey(relation);
    if (relationKeys.has(key)) fail('hay relaciones duplicadas.');
    relationKeys.add(key);
  }

  uniqueIds(revisions, 'artifactRevisions');
  const revisionKeys = new Set();
  for (const revision of revisions) {
    validateRevision(revision, artifactMap, projectIds);
    const key = `${revision.artifactId}\u001f${revision.revision}`;
    if (revisionKeys.has(key)) fail('hay números de revisión duplicados.');
    revisionKeys.add(key);
  }
  return clone(raw);
}
