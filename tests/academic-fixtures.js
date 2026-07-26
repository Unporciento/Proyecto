import { IDBFactory } from 'fake-indexeddb';
import {
  ACADEMIC_DB_VERSION,
  openCompatibleDatabase
} from '../js/academic/academic-migrations.js';
import { AcademicRepository } from '../js/academic/academic-repository.js';

export const NOW = '2026-07-26T12:00:00.000Z';

export function makeProject(id = 'project_one', subjectId = 'subject_one') {
  return {
    id, subjectId, title: `Proyecto ${id}`, description: '', status: 'active',
    schemaVersion: 1, createdAt: NOW, updatedAt: NOW,
    submittedAt: null, archivedAt: null
  };
}

export function makeArtifact(id, projectId, kind, data, parentId = null) {
  return {
    id, projectId, parentId, kind, title: id, status: 'draft', position: 0,
    data, schemaVersion: 1, createdAt: NOW, updatedAt: NOW
  };
}

export function makeRelation(id, projectId, fromId, toId, type) {
  return {
    id, projectId, fromId, toId, type, note: '', schemaVersion: 1, createdAt: NOW
  };
}

export const DATA = Object.freeze({
  source: {
    sourceType: 'article', authors: ['FORJA'], publicationTitle: 'Fuente',
    publisher: '', year: 2026, url: '', accessedAt: null, notes: ''
  },
  documentRef: { documentId: 'document_one', role: 'source_file' },
  rubric: { description: '', totalPoints: 100, scaleLabel: 'puntos' },
  criterion: {
    code: 'C1', description: 'Demuestra el resultado', maxPoints: 30,
    weight: 30, required: true
  },
  evidence: {
    summary: 'La prueba principal', excerpt: 'Resultado',
    locator: { page: 2, section: 'Resultados', timestamp: null },
    confidence: 'confirmed'
  },
  report: { reportType: 'academic', abstract: '', language: 'es' },
  section: { heading: 'Resultados', body: 'La evidencia demuestra el criterio.' }
});

export function makeGraph(projectId = 'project_one', subjectId = 'subject_one') {
  const project = makeProject(projectId, subjectId);
  const artifacts = [
    makeArtifact(`${projectId}_source`, projectId, 'source', DATA.source),
    makeArtifact(`${projectId}_docref`, projectId, 'document_ref', DATA.documentRef),
    makeArtifact(`${projectId}_rubric`, projectId, 'rubric', DATA.rubric),
    makeArtifact(`${projectId}_criterion`, projectId, 'rubric_criterion', DATA.criterion, `${projectId}_rubric`),
    makeArtifact(`${projectId}_evidence`, projectId, 'evidence', DATA.evidence),
    makeArtifact(`${projectId}_report`, projectId, 'report', DATA.report),
    makeArtifact(`${projectId}_section`, projectId, 'report_section', DATA.section, `${projectId}_report`)
  ];
  const relations = [
    makeRelation(`${projectId}_r1`, projectId, `${projectId}_docref`, `${projectId}_source`, 'attached_to'),
    makeRelation(`${projectId}_r2`, projectId, `${projectId}_evidence`, `${projectId}_source`, 'derived_from'),
    makeRelation(`${projectId}_r3`, projectId, `${projectId}_evidence`, `${projectId}_criterion`, 'satisfies'),
    makeRelation(`${projectId}_r4`, projectId, `${projectId}_evidence`, `${projectId}_section`, 'supports'),
    makeRelation(`${projectId}_r5`, projectId, `${projectId}_section`, `${projectId}_source`, 'cites')
  ];
  return { project, artifacts, relations };
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function testRepository(name = crypto.randomUUID()) {
  const factory = new IDBFactory();
  const database = await openCompatibleDatabase({
    name,
    factory,
    targetVersion: ACADEMIC_DB_VERSION
  });
  const tx = database.transaction(['subjects', 'documents'], 'readwrite');
  tx.objectStore('subjects').add({ id: 'subject_one', name: 'Metodología', createdAt: NOW });
  tx.objectStore('subjects').add({ id: 'subject_two', name: 'Ingeniería', createdAt: NOW });
  tx.objectStore('documents').add({
    id: 'document_one', subjectId: 'subject_one', name: 'Artículo',
    text: 'Resultado verificable', createdAt: NOW
  });
  await transactionDone(tx);
  return { database, repository: new AcademicRepository(async () => database) };
}
