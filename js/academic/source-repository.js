import { validateArtifact } from './artifact-schemas.js';
import { validateRelation } from './relation-model.js';
import { SOURCE_TYPES } from './source-model.js';
import { requestResult, transactionDone } from './repository-helpers.js';

const STORES = ['documents', 'academicProjects', 'projectArtifacts', 'artifactRelations'];

function fail(message) {
  throw new TypeError(`Integridad académica: ${message}`);
}

function sourcePage(store, projectId, { sourceType, limit, offset }) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let skipped = 0;
    const request = store.index('projectKind').openCursor([projectId, 'source']);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || rows.length >= limit) return resolve(rows);
      const source = cursor.value;
      const matches = !sourceType || source.data.sourceType === sourceType;
      if (matches && skipped < offset) skipped += 1;
      else if (matches) rows.push(source);
      cursor.continue();
    };
  });
}

export async function listSources(provider, projectId, {
  sourceType = null,
  limit = 60,
  offset = 0
} = {}) {
  if (sourceType && !SOURCE_TYPES.includes(sourceType)) fail('el tipo de fuente no existe.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) fail('el límite no es válido.');
  if (!Number.isInteger(offset) || offset < 0) fail('el desplazamiento no es válido.');
  const db = await provider();
  const tx = db.transaction(['academicProjects', 'projectArtifacts']);
  const [project, rows] = await Promise.all([
    requestResult(tx.objectStore('academicProjects').get(projectId)),
    sourcePage(
      tx.objectStore('projectArtifacts'),
      projectId,
      { sourceType, limit, offset }
    )
  ]);
  if (!project) fail('el proyecto no existe.');
  return rows;
}

export async function listSourceDocuments(provider, projectId) {
  const db = await provider();
  const tx = db.transaction(['academicProjects', 'documents']);
  const [project, documents] = await Promise.all([
    requestResult(tx.objectStore('academicProjects').get(projectId)),
    requestResult(tx.objectStore('documents').getAll())
  ]);
  if (!project) fail('el proyecto no existe.');
  return documents.filter(document => document.subjectId === project.subjectId);
}

export async function getSourceDetails(provider, sourceId) {
  const db = await provider();
  const tx = db.transaction(['documents', 'projectArtifacts', 'artifactRelations']);
  const artifacts = tx.objectStore('projectArtifacts');
  const relations = tx.objectStore('artifactRelations');
  const [source, attached] = await Promise.all([
    requestResult(artifacts.get(sourceId)),
    requestResult(relations.index('toId').getAll(sourceId))
  ]);
  if (!source || source.kind !== 'source') fail('la fuente no existe.');
  const relation = attached.find(item => item.type === 'attached_to') || null;
  if (!relation) return { source, reference: null, relation: null, document: null };
  const referenceTx = db.transaction('projectArtifacts');
  const reference = await requestResult(
    referenceTx.objectStore('projectArtifacts').get(relation.fromId)
  );
  const document = reference?.kind === 'document_ref'
    ? await requestResult(
      db.transaction('documents').objectStore('documents').get(reference.data.documentId)
    )
    : null;
  return { source, reference, relation, document };
}

async function removableReference(relations, referenceId, removedRelationIds) {
  const linked = await requestResult(relations.index('fromId').getAll(referenceId));
  return linked.every(item => removedRelationIds.has(item.id));
}

export async function saveSourceBundle(provider, bundle, { existing = false } = {}) {
  validateArtifact(bundle.source);
  if (bundle.source.kind !== 'source') fail('el artefacto no es una fuente.');
  if (Boolean(bundle.documentRef) !== Boolean(bundle.relation)) {
    fail('la referencia documental está incompleta.');
  }
  if (bundle.documentRef) {
    validateArtifact(bundle.documentRef);
    validateRelation(bundle.relation, bundle.documentRef, bundle.source);
  }

  const db = await provider();
  const tx = db.transaction(STORES, 'readwrite');
  const done = transactionDone(tx);
  try {
    const projects = tx.objectStore('academicProjects');
    const artifacts = tx.objectStore('projectArtifacts');
    const relations = tx.objectStore('artifactRelations');
    const [project, stored, attached] = await Promise.all([
      requestResult(projects.get(bundle.source.projectId)),
      requestResult(artifacts.get(bundle.source.id)),
      requestResult(relations.index('toId').getAll(bundle.source.id))
    ]);
    if (!project) fail('el proyecto no existe.');
    if (existing && (!stored || stored.kind !== 'source')) fail('la fuente no existe.');
    if (!existing && stored) fail('la fuente ya existe.');
    if (stored && stored.projectId !== bundle.source.projectId) {
      fail('la fuente no puede cambiar de proyecto.');
    }
    if (bundle.documentRef) {
      const document = await requestResult(
        tx.objectStore('documents').get(bundle.documentRef.data.documentId)
      );
      if (!document) fail('el documento referenciado no existe.');
    }

    const oldAttached = attached.filter(item => item.type === 'attached_to');
    const removedIds = new Set(oldAttached.map(item => item.id));
    const oldReferences = await Promise.all(
      oldAttached.map(item => requestResult(artifacts.get(item.fromId)))
    );
    for (const relation of oldAttached) relations.delete(relation.id);
    for (const reference of oldReferences.filter(Boolean)) {
      const reused = bundle.documentRef?.id === reference.id;
      if (!reused && await removableReference(relations, reference.id, removedIds)) {
        artifacts.delete(reference.id);
      }
    }

    artifacts.put(bundle.source);
    if (bundle.documentRef) {
      artifacts.put(bundle.documentRef);
      relations.put(bundle.relation);
    }
  } catch (error) {
    tx.abort();
    await done.catch(() => {});
    throw error;
  }
  await done;
  return getSourceDetails(provider, bundle.source.id);
}

export async function deleteSource(provider, sourceId) {
  const db = await provider();
  const tx = db.transaction(['projectArtifacts', 'artifactRelations'], 'readwrite');
  const done = transactionDone(tx);
  try {
    const artifacts = tx.objectStore('projectArtifacts');
    const relations = tx.objectStore('artifactRelations');
    const [source, from, to] = await Promise.all([
      requestResult(artifacts.get(sourceId)),
      requestResult(relations.index('fromId').getAll(sourceId)),
      requestResult(relations.index('toId').getAll(sourceId))
    ]);
    if (!source || source.kind !== 'source') fail('la fuente no existe.');
    const removed = new Map([...from, ...to].map(item => [item.id, item]));
    const attached = to.filter(item => item.type === 'attached_to');
    for (const relation of removed.values()) relations.delete(relation.id);
    const removedIds = new Set(removed.keys());
    for (const relation of attached) {
      if (await removableReference(relations, relation.fromId, removedIds)) {
        artifacts.delete(relation.fromId);
      }
    }
    artifacts.delete(sourceId);
  } catch (error) {
    tx.abort();
    await done.catch(() => {});
    throw error;
  }
  await done;
}
