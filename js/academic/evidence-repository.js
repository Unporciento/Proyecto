import { validateArtifact } from './artifact-schemas.js';
import { EVIDENCE_STATES, EVIDENCE_TYPES } from './evidence-model.js';
import { validateRelation } from './relation-model.js';
import { requestResult, transactionDone } from './repository-helpers.js';

const STORES = ['documents', 'academicProjects', 'projectArtifacts', 'artifactRelations'];

function fail(message) {
  throw new TypeError(`Integridad académica: ${message}`);
}

function evidencePage(store, projectId, { state, evidenceType, limit, offset }) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let skipped = 0;
    const request = store.index('projectKind').openCursor([projectId, 'evidence']);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || rows.length >= limit) return resolve(rows);
      const evidence = cursor.value;
      const data = evidence.schemaVersion === 2 ? evidence.data : null;
      const matches = (!state || data?.state === state)
        && (!evidenceType || data?.evidenceType === evidenceType);
      if (matches && skipped < offset) skipped += 1;
      else if (matches) rows.push(evidence);
      cursor.continue();
    };
  });
}

export async function getEvidenceOptions(provider, projectId) {
  const db = await provider();
  const tx = db.transaction(['documents', 'academicProjects', 'projectArtifacts']);
  const artifacts = tx.objectStore('projectArtifacts');
  const [project, sources, criteria, rubrics, documents] = await Promise.all([
    requestResult(tx.objectStore('academicProjects').get(projectId)),
    requestResult(artifacts.index('projectKind').getAll([projectId, 'source'])),
    requestResult(artifacts.index('projectKind').getAll([projectId, 'rubric_criterion'])),
    requestResult(artifacts.index('projectKind').getAll([projectId, 'rubric'])),
    requestResult(tx.objectStore('documents').getAll())
  ]);
  if (!project) fail('el proyecto no existe.');
  const rubricIds = new Set(rubrics.map(item => item.id));
  return {
    sources,
    criteria: criteria.filter(item => rubricIds.has(item.parentId))
      .sort((a, b) => a.position - b.position),
    documents: documents.filter(item => item.subjectId === project.subjectId)
  };
}

export async function listEvidenceSummaries(provider, projectId, {
  state = null,
  evidenceType = null,
  limit = 60,
  offset = 0
} = {}) {
  if (state && !EVIDENCE_STATES.includes(state)) fail('el estado no existe.');
  if (evidenceType && !EVIDENCE_TYPES.includes(evidenceType)) fail('el tipo no existe.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) fail('el límite no es válido.');
  if (!Number.isInteger(offset) || offset < 0) fail('el desplazamiento no es válido.');
  const db = await provider();
  const tx = db.transaction(['academicProjects', 'projectArtifacts', 'artifactRelations']);
  const [project, rows, relations] = await Promise.all([
    requestResult(tx.objectStore('academicProjects').get(projectId)),
    evidencePage(tx.objectStore('projectArtifacts'), projectId, {
      state, evidenceType, limit, offset
    }),
    requestResult(tx.objectStore('artifactRelations').index('projectId').getAll(projectId))
  ]);
  if (!project) fail('el proyecto no existe.');
  return rows.map(evidence => ({
    evidence,
    sourceIds: relations.filter(item =>
      item.type === 'derived_from' && item.fromId === evidence.id
    ).map(item => item.toId),
    criterionIds: relations.filter(item =>
      item.type === 'satisfies' && item.fromId === evidence.id
    ).map(item => item.toId)
  }));
}

export async function getEvidenceDetails(provider, evidenceId) {
  const db = await provider();
  const tx = db.transaction(['projectArtifacts', 'artifactRelations']);
  const artifacts = tx.objectStore('projectArtifacts');
  const relations = tx.objectStore('artifactRelations');
  const [evidence, from, to] = await Promise.all([
    requestResult(artifacts.get(evidenceId)),
    requestResult(relations.index('fromId').getAll(evidenceId)),
    requestResult(relations.index('toId').getAll(evidenceId))
  ]);
  if (!evidence || evidence.kind !== 'evidence') fail('la evidencia no existe.');
  const owned = [
    ...from.filter(item => ['derived_from', 'satisfies'].includes(item.type)),
    ...to.filter(item => item.type === 'attached_to')
  ];
  const attachment = owned.find(item => item.type === 'attached_to') || null;
  const documentRef = attachment
    ? await requestResult(
      db.transaction('projectArtifacts').objectStore('projectArtifacts').get(attachment.fromId)
    )
    : null;
  const document = documentRef?.kind === 'document_ref'
    ? await requestResult(
      db.transaction('documents').objectStore('documents').get(documentRef.data.documentId)
    )
    : null;
  return { evidence, documentRef, document, relations: owned };
}

async function removableReference(relations, referenceId, removedIds) {
  const linked = await requestResult(relations.index('fromId').getAll(referenceId));
  return linked.every(item => removedIds.has(item.id));
}

export async function saveEvidenceBundle(provider, bundle, { existing = false } = {}) {
  validateArtifact(bundle.evidence);
  if (bundle.evidence.kind !== 'evidence') fail('el artefacto no es una evidencia.');
  if (bundle.documentRef) validateArtifact(bundle.documentRef);

  const db = await provider();
  const tx = db.transaction(STORES, 'readwrite');
  const done = transactionDone(tx);
  try {
    const artifacts = tx.objectStore('projectArtifacts');
    const relations = tx.objectStore('artifactRelations');
    const [project, stored, from, to] = await Promise.all([
      requestResult(tx.objectStore('academicProjects').get(bundle.evidence.projectId)),
      requestResult(artifacts.get(bundle.evidence.id)),
      requestResult(relations.index('fromId').getAll(bundle.evidence.id)),
      requestResult(relations.index('toId').getAll(bundle.evidence.id))
    ]);
    if (!project) fail('el proyecto no existe.');
    if (existing && (!stored || stored.kind !== 'evidence')) fail('la evidencia no existe.');
    if (!existing && stored) fail('la evidencia ya existe.');
    if (stored && stored.projectId !== bundle.evidence.projectId) {
      fail('la evidencia no puede cambiar de proyecto.');
    }

    const endpoints = new Map();
    if (bundle.documentRef) endpoints.set(bundle.documentRef.id, bundle.documentRef);
    const endpointIds = [...new Set(bundle.relations.map(relation =>
      relation.fromId === bundle.evidence.id ? relation.toId : relation.fromId
    ))].filter(id => !endpoints.has(id));
    const endpointRows = await Promise.all(
      endpointIds.map(id => requestResult(artifacts.get(id)))
    );
    endpointIds.forEach((id, index) => endpoints.set(id, endpointRows[index]));
    const criteria = [...endpoints.values()].filter(item =>
      item?.kind === 'rubric_criterion'
    );
    const rubricIds = [...new Set(criteria.map(item => item.parentId))];
    const rubricRows = await Promise.all(
      rubricIds.map(id => requestResult(artifacts.get(id)))
    );
    if (rubricRows.some(item =>
      !item || item.kind !== 'rubric' || item.projectId !== bundle.evidence.projectId
    )) {
      fail('algún criterio no pertenece a la rúbrica del proyecto.');
    }
    for (const relation of bundle.relations) {
      const fromArtifact = relation.fromId === bundle.evidence.id
        ? bundle.evidence
        : endpoints.get(relation.fromId);
      const toArtifact = relation.toId === bundle.evidence.id
        ? bundle.evidence
        : endpoints.get(relation.toId);
      validateRelation(relation, fromArtifact, toArtifact);
    }
    if (bundle.documentRef) {
      const document = await requestResult(
        tx.objectStore('documents').get(bundle.documentRef.data.documentId)
      );
      if (!document) fail('el documento referenciado no existe.');
      if (document.subjectId !== project.subjectId) {
        fail('el documento pertenece a otra asignatura.');
      }
    }

    const oldOwned = [
      ...from.filter(item => ['derived_from', 'satisfies'].includes(item.type)),
      ...to.filter(item => item.type === 'attached_to')
    ];
    const removedIds = new Set(oldOwned.map(item => item.id));
    const oldReferences = await Promise.all(
      oldOwned.filter(item => item.type === 'attached_to')
        .map(item => requestResult(artifacts.get(item.fromId)))
    );
    oldOwned.forEach(item => relations.delete(item.id));
    for (const reference of oldReferences.filter(Boolean)) {
      if (reference.id !== bundle.documentRef?.id
        && await removableReference(relations, reference.id, removedIds)) {
        artifacts.delete(reference.id);
      }
    }
    artifacts.put(bundle.evidence);
    if (bundle.documentRef) artifacts.put(bundle.documentRef);
    bundle.relations.forEach(item => relations.put(item));
  } catch (error) {
    tx.abort();
    await done.catch(() => {});
    throw error;
  }
  await done;
  return getEvidenceDetails(provider, bundle.evidence.id);
}

export async function deleteEvidence(provider, evidenceId) {
  const db = await provider();
  const tx = db.transaction(['projectArtifacts', 'artifactRelations'], 'readwrite');
  const done = transactionDone(tx);
  try {
    const artifacts = tx.objectStore('projectArtifacts');
    const relations = tx.objectStore('artifactRelations');
    const [evidence, from, to] = await Promise.all([
      requestResult(artifacts.get(evidenceId)),
      requestResult(relations.index('fromId').getAll(evidenceId)),
      requestResult(relations.index('toId').getAll(evidenceId))
    ]);
    if (!evidence || evidence.kind !== 'evidence') fail('la evidencia no existe.');
    const removed = new Map([...from, ...to].map(item => [item.id, item]));
    const attachments = to.filter(item => item.type === 'attached_to');
    removed.forEach(item => relations.delete(item.id));
    const removedIds = new Set(removed.keys());
    for (const attachment of attachments) {
      if (await removableReference(relations, attachment.fromId, removedIds)) {
        artifacts.delete(attachment.fromId);
      }
    }
    artifacts.delete(evidenceId);
  } catch (error) {
    tx.abort();
    await done.catch(() => {});
    throw error;
  }
  await done;
}
