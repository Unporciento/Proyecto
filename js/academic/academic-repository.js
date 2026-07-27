import { validateArtifact, validateArtifactParent } from './artifact-schemas.js';
import {
  deleteEvidence,
  getEvidenceDetails,
  getEvidenceOptions,
  listEvidenceSummaries,
  saveEvidenceBundle
} from './evidence-repository.js';
import {
  assertProjectSubject,
  normalizeProjectTitle,
  validateProject
} from './project-model.js';
import { relationKey, validateRelation } from './relation-model.js';
import {
  deleteRubric,
  getProjectRubric,
  saveRubricBundle
} from './rubric-repository.js';
import {
  deleteSource,
  getSourceDetails,
  listSourceDocuments,
  listSources,
  saveSourceBundle
} from './source-repository.js';
import {
  requestResult,
  rowsByIndex,
  transactionDone
} from './repository-helpers.js';
import { openForjaDatabase } from '../db.js';

const GRAPH_STORES = [
  'subjects',
  'documents',
  'academicProjects',
  'projectArtifacts',
  'artifactRelations'
];
const PROJECT_DELETE_STORES = [
  'academicProjects',
  'projectArtifacts',
  'artifactRelations',
  'artifactRevisions'
];

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

async function assertUniqueProject(store, project) {
  const candidates = await requestResult(store.index('subjectId').getAll(project.subjectId));
  const title = normalizeProjectTitle(project.title);
  if (candidates.some(item =>
    item.id !== project.id && normalizeProjectTitle(item.title) === title
  )) {
    fail('ya existe un proyecto con ese nombre en la asignatura.');
  }
}

function projectPage(store, { subjectId, status, limit, offset }) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let skipped = 0;
    const request = store.index('updatedAt').openCursor(null, 'prev');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || rows.length >= limit) return resolve(rows);
      const project = cursor.value;
      const matches = (!subjectId || project.subjectId === subjectId)
        && (!status || project.status === status);
      if (matches && skipped < offset) skipped += 1;
      else if (matches) rows.push(project);
      cursor.continue();
    };
  });
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
      const projects = tx.objectStore('academicProjects');
      await assertUniqueProject(projects, project);
      projects.add(project);
    } catch (error) {
      tx.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
    return structuredClone(project);
  }

  async listSubjects() {
    const db = await this.databaseProvider();
    return requestResult(db.transaction('subjects').objectStore('subjects').getAll());
  }

  async listProjects({ subjectId = null, status = null, limit = 60, offset = 0 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new TypeError('El límite de proyectos debe estar entre 1 y 500.');
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new TypeError('El desplazamiento de proyectos no es válido.');
    }
    const db = await this.databaseProvider();
    const store = db.transaction('academicProjects').objectStore('academicProjects');
    return projectPage(store, { subjectId, status, limit, offset });
  }

  async getProject(projectId) {
    const db = await this.databaseProvider();
    const project = await requestResult(
      db.transaction('academicProjects').objectStore('academicProjects').get(projectId)
    );
    if (!project) fail('el proyecto no existe.');
    return project;
  }

  async updateProject(project) {
    validateProject(project);
    const db = await this.databaseProvider();
    const tx = db.transaction(['subjects', 'academicProjects'], 'readwrite');
    const done = transactionDone(tx);
    try {
      const projects = tx.objectStore('academicProjects');
      const current = await requestResult(projects.get(project.id));
      if (!current) fail('el proyecto no existe.');
      const subject = await requestResult(tx.objectStore('subjects').get(project.subjectId));
      assertProjectSubject(project, subject);
      await assertUniqueProject(projects, project);
      projects.put(project);
    } catch (error) {
      tx.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
    return structuredClone(project);
  }

  async archiveProject(projectId, now = new Date()) {
    const current = await this.getProject(projectId);
    const archived = {
      ...current,
      status: 'archived',
      updatedAt: new Date(now).toISOString(),
      archivedAt: current.archivedAt || new Date(now).toISOString()
    };
    return this.updateProject(archived);
  }

  async deleteProject(projectId) {
    const db = await this.databaseProvider();
    const tx = db.transaction(PROJECT_DELETE_STORES, 'readwrite');
    const done = transactionDone(tx);
    try {
      const projects = tx.objectStore('academicProjects');
      const existing = await requestResult(projects.get(projectId));
      if (!existing) fail('el proyecto no existe.');
      const childStores = PROJECT_DELETE_STORES.slice(1).map(name => tx.objectStore(name));
      const keyGroups = await Promise.all(childStores.map(store =>
        requestResult(store.index('projectId').getAllKeys(projectId))
      ));
      childStores.forEach((store, index) =>
        keyGroups[index].forEach(key => store.delete(key))
      );
      projects.delete(projectId);
    } catch (error) {
      tx.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
  }

  async listSources(projectId, options) {
    return listSources(this.databaseProvider, projectId, options);
  }

  async listSourceDocuments(projectId) {
    return listSourceDocuments(this.databaseProvider, projectId);
  }

  async getSourceDetails(sourceId) {
    return getSourceDetails(this.databaseProvider, sourceId);
  }

  async createSourceBundle(bundle) {
    return saveSourceBundle(this.databaseProvider, bundle);
  }

  async updateSourceBundle(bundle) {
    return saveSourceBundle(this.databaseProvider, bundle, { existing: true });
  }

  async deleteSource(sourceId) {
    return deleteSource(this.databaseProvider, sourceId);
  }

  async getProjectRubric(projectId) {
    return getProjectRubric(this.databaseProvider, projectId);
  }

  async createRubricBundle(bundle) {
    return saveRubricBundle(this.databaseProvider, bundle);
  }

  async updateRubricBundle(bundle) {
    return saveRubricBundle(this.databaseProvider, bundle, { existing: true });
  }

  async deleteRubric(rubricId) {
    return deleteRubric(this.databaseProvider, rubricId);
  }

  async getEvidenceOptions(projectId) {
    return getEvidenceOptions(this.databaseProvider, projectId);
  }

  async listEvidenceSummaries(projectId, options) {
    return listEvidenceSummaries(this.databaseProvider, projectId, options);
  }

  async getEvidenceDetails(evidenceId) {
    return getEvidenceDetails(this.databaseProvider, evidenceId);
  }

  async createEvidenceBundle(bundle) {
    return saveEvidenceBundle(this.databaseProvider, bundle);
  }

  async updateEvidenceBundle(bundle) {
    return saveEvidenceBundle(this.databaseProvider, bundle, { existing: true });
  }

  async deleteEvidence(evidenceId) {
    return deleteEvidence(this.databaseProvider, evidenceId);
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
      await assertUniqueProject(tx.objectStore('academicProjects'), project);
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
