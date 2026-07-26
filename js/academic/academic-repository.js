import { validateArtifact, validateArtifactParent } from './artifact-schemas.js';
import { assertProjectSubject, validateProject } from './project-model.js';
import { relationKey, validateRelation } from './relation-model.js';
import { openForjaDatabase } from '../db.js';

const GRAPH_STORES = [
  'subjects',
  'documents',
  'academicProjects',
  'projectArtifacts',
  'artifactRelations'
];

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('La operación académica fue cancelada.'));
  });
}

function fail(message) {
  throw new TypeError(`Integridad académica: ${message}`);
}

function validateGraphShape(project, artifacts, relations) {
  validateProject(project);
  const artifactMap = new Map();
  for (const artifact of artifacts) {
    validateArtifact(artifact);
    if (artifact.projectId !== project.id) fail('todos los artefactos deben pertenecer al proyecto.');
    if (artifactMap.has(artifact.id)) fail('hay identificadores de artefacto duplicados.');
    artifactMap.set(artifact.id, artifact);
  }
  for (const artifact of artifacts) {
    validateArtifactParent(artifact, artifact.parentId ? artifactMap.get(artifact.parentId) : null);
  }
  const relationKeys = new Set();
  for (const relation of relations) {
    validateRelation(relation, artifactMap.get(relation.fromId), artifactMap.get(relation.toId));
    const key = relationKey(relation);
    if (relationKeys.has(key)) fail('hay una relación duplicada.');
    relationKeys.add(key);
  }
  return artifactMap;
}

async function rowsByIndex(store, index, value) {
  return requestResult(store.index(index).getAll(value));
}

export class AcademicRepository {
  constructor(databaseProvider = openForjaDatabase) {
    this.databaseProvider = databaseProvider;
  }

  async createProject(project) {
    validateProject(project);
    const db = await this.databaseProvider();
    const tx = db.transaction(['subjects', 'academicProjects'], 'readwrite');
    const done = transactionDone(tx);
    try {
      const subject = await requestResult(tx.objectStore('subjects').get(project.subjectId));
      assertProjectSubject(project, subject);
      tx.objectStore('academicProjects').add(project);
    } catch (error) {
      tx.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
    return structuredClone(project);
  }

  async createArtifact(artifact) {
    validateArtifact(artifact);
    const db = await this.databaseProvider();
    const tx = db.transaction(
      ['documents', 'academicProjects', 'projectArtifacts'],
      'readwrite'
    );
    const done = transactionDone(tx);
    try {
      const projects = tx.objectStore('academicProjects');
      const artifacts = tx.objectStore('projectArtifacts');
      const project = await requestResult(projects.get(artifact.projectId));
      if (!project) fail('el proyecto no existe.');
      const parent = artifact.parentId
        ? await requestResult(artifacts.get(artifact.parentId))
        : null;
      validateArtifactParent(artifact, parent);
      if (artifact.kind === 'document_ref') {
        const document = await requestResult(tx.objectStore('documents').get(artifact.data.documentId));
        if (!document) fail('el documento referenciado no existe.');
      }
      artifacts.add(artifact);
    } catch (error) {
      tx.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
    return structuredClone(artifact);
  }

  async createRelation(relation) {
    const db = await this.databaseProvider();
    const tx = db.transaction(['projectArtifacts', 'artifactRelations'], 'readwrite');
    const done = transactionDone(tx);
    try {
      const artifacts = tx.objectStore('projectArtifacts');
      const from = await requestResult(artifacts.get(relation.fromId));
      const to = await requestResult(artifacts.get(relation.toId));
      validateRelation(relation, from, to);
      const duplicate = await requestResult(
        tx.objectStore('artifactRelations').index('identity').get([
          relation.projectId, relation.fromId, relation.toId, relation.type
        ])
      );
      if (duplicate) fail('la relación ya existe.');
      tx.objectStore('artifactRelations').add(relation);
    } catch (error) {
      tx.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
    return structuredClone(relation);
  }

  async createGraph({ project, artifacts, relations }) {
    const artifactMap = validateGraphShape(project, artifacts, relations);
    const db = await this.databaseProvider();
    const tx = db.transaction(GRAPH_STORES, 'readwrite');
    const done = transactionDone(tx);
    try {
      const subject = await requestResult(tx.objectStore('subjects').get(project.subjectId));
      assertProjectSubject(project, subject);
      for (const artifact of artifactMap.values()) {
        if (artifact.kind !== 'document_ref') continue;
        const document = await requestResult(tx.objectStore('documents').get(artifact.data.documentId));
        if (!document) fail('el documento referenciado no existe.');
      }
      tx.objectStore('academicProjects').add(project);
      for (const artifact of artifacts) tx.objectStore('projectArtifacts').add(artifact);
      for (const relation of relations) tx.objectStore('artifactRelations').add(relation);
    } catch (error) {
      tx.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
    return this.getProjectTraceability(project.id);
  }

  async getProjectTraceability(projectId) {
    const db = await this.databaseProvider();
    const tx = db.transaction(
      ['documents', 'academicProjects', 'projectArtifacts', 'artifactRelations'],
      'readonly'
    );
    const project = await requestResult(tx.objectStore('academicProjects').get(projectId));
    if (!project) fail('el proyecto no existe.');
    const artifacts = await rowsByIndex(tx.objectStore('projectArtifacts'), 'projectId', projectId);
    const relations = await rowsByIndex(tx.objectStore('artifactRelations'), 'projectId', projectId);
    const documents = [];
    for (const reference of artifacts.filter(item => item.kind === 'document_ref')) {
      const document = await requestResult(tx.objectStore('documents').get(reference.data.documentId));
      if (document) documents.push(document);
    }
    const byKind = Object.groupBy
      ? Object.groupBy(artifacts, item => item.kind)
      : artifacts.reduce((groups, item) => {
        (groups[item.kind] ||= []).push(item);
        return groups;
      }, {});
    return { project, artifacts, relations, documents, byKind };
  }
}
