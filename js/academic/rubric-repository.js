import { validateRubricBundle } from './rubric-model.js';
import { requestResult, rowsByIndex, transactionDone } from './repository-helpers.js';

function fail(message) {
  throw new TypeError(`Integridad académica: ${message}`);
}

function sortCriteria(rows) {
  return rows.sort((left, right) =>
    left.position - right.position || left.createdAt.localeCompare(right.createdAt)
  );
}

export async function getProjectRubric(provider, projectId) {
  const db = await provider();
  const tx = db.transaction(['academicProjects', 'projectArtifacts']);
  const artifacts = tx.objectStore('projectArtifacts');
  const [project, rubrics] = await Promise.all([
    requestResult(tx.objectStore('academicProjects').get(projectId)),
    requestResult(artifacts.index('projectKind').getAll([projectId, 'rubric']))
  ]);
  if (!project) fail('el proyecto no existe.');
  if (!rubrics.length) return null;
  if (rubrics.length > 1) fail('el proyecto contiene más de una rúbrica.');
  const rubric = rubrics[0];
  const criteria = await rowsByIndex(
    db.transaction('projectArtifacts').objectStore('projectArtifacts'),
    'parentId',
    rubric.id
  );
  return { rubric, criteria: sortCriteria(criteria.filter(row => row.kind === 'rubric_criterion')) };
}

export async function saveRubricBundle(provider, bundle, { existing = false } = {}) {
  validateRubricBundle(bundle);
  const db = await provider();
  const tx = db.transaction(
    ['academicProjects', 'projectArtifacts', 'artifactRelations'],
    'readwrite'
  );
  const done = transactionDone(tx);
  try {
    const artifacts = tx.objectStore('projectArtifacts');
    const [project, stored, rubrics, oldChildren] = await Promise.all([
      requestResult(tx.objectStore('academicProjects').get(bundle.rubric.projectId)),
      requestResult(artifacts.get(bundle.rubric.id)),
      requestResult(artifacts.index('projectKind').getAll([
        bundle.rubric.projectId, 'rubric'
      ])),
      requestResult(artifacts.index('parentId').getAll(bundle.rubric.id))
    ]);
    if (!project) fail('el proyecto no existe.');
    if (existing && (!stored || stored.kind !== 'rubric')) fail('la rúbrica no existe.');
    if (!existing && (stored || rubrics.length)) fail('el proyecto ya tiene una rúbrica.');
    if (stored && stored.projectId !== bundle.rubric.projectId) {
      fail('la rúbrica no puede cambiar de proyecto.');
    }
    const incomingIds = new Set(bundle.criteria.map(item => item.id));
    const oldIds = new Set(oldChildren.map(item => item.id));
    const unknownCriteria = bundle.criteria.filter(item => !oldIds.has(item.id));
    const collisions = await Promise.all(
      unknownCriteria.map(item => requestResult(artifacts.get(item.id)))
    );
    for (const criterion of bundle.criteria) {
      if (criterion.projectId !== bundle.rubric.projectId
        || criterion.parentId !== bundle.rubric.id) {
        fail('el criterio pertenece a otra rúbrica.');
      }
    }
    if (collisions.some(Boolean)) {
      fail('algún criterio ya existe en otro lugar.');
    }
    const removedIds = new Set(
      oldChildren.filter(item => !incomingIds.has(item.id)).map(item => item.id)
    );
    if (removedIds.size) {
      const relationStore = tx.objectStore('artifactRelations');
      const related = await requestResult(
        relationStore.index('projectId').getAll(bundle.rubric.projectId)
      );
      related.filter(item => removedIds.has(item.fromId) || removedIds.has(item.toId))
        .forEach(item => relationStore.delete(item.id));
      removedIds.forEach(id => artifacts.delete(id));
    }
    artifacts.put(bundle.rubric);
    bundle.criteria.forEach(item => artifacts.put(item));
  } catch (error) {
    tx.abort();
    await done.catch(() => {});
    throw error;
  }
  await done;
  return getProjectRubric(provider, bundle.rubric.projectId);
}

export async function deleteRubric(provider, rubricId) {
  const db = await provider();
  const tx = db.transaction(['projectArtifacts', 'artifactRelations'], 'readwrite');
  const done = transactionDone(tx);
  try {
    const artifacts = tx.objectStore('projectArtifacts');
    const relations = tx.objectStore('artifactRelations');
    const rubric = await requestResult(artifacts.get(rubricId));
    if (!rubric || rubric.kind !== 'rubric') fail('la rúbrica no existe.');
    const children = await requestResult(artifacts.index('parentId').getAll(rubricId));
    const ids = new Set([rubricId, ...children.map(item => item.id)]);
    const related = await requestResult(relations.index('projectId').getAll(rubric.projectId));
    related.filter(item => ids.has(item.fromId) || ids.has(item.toId))
      .forEach(item => relations.delete(item.id));
    children.forEach(item => artifacts.delete(item.id));
    artifacts.delete(rubricId);
  } catch (error) {
    tx.abort();
    await done.catch(() => {});
    throw error;
  }
  await done;
}
