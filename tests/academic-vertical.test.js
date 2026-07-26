import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {
  exportDatabase,
  replaceDatabase
} from '../js/db.js';
import { validateBackup } from '../js/backup.js';
import {
  makeGraph,
  testRepository
} from './academic-fixtures.js';

test('flujo vertical conserva trazabilidad después de exportar y restaurar', async () => {
  const { database, repository } = await testRepository('vertical-v3');
  const graph = makeGraph('project_vertical', 'subject_one');
  const initial = await repository.createGraph(graph);
  assert.equal(initial.artifacts.length, 7);
  assert.equal(initial.relations.length, 5);
  assert.deepEqual(initial.documents.map(item => item.id), ['document_one']);

  const relationTypes = new Set(initial.relations.map(item => item.type));
  assert.deepEqual(
    relationTypes,
    new Set(['attached_to', 'derived_from', 'satisfies', 'supports', 'cites'])
  );
  assert.equal(initial.byKind.rubric_criterion[0].parentId, 'project_vertical_rubric');
  assert.equal(initial.byKind.report_section[0].parentId, 'project_vertical_report');

  const exported = await exportDatabase(database);
  const restoredPayload = validateBackup(exported);
  assert.equal(restoredPayload.version, 2);
  const stores = Array.from(database.objectStoreNames);
  const clear = database.transaction(stores, 'readwrite');
  stores.forEach(name => clear.objectStore(name).clear());
  await new Promise((resolve, reject) => {
    clear.oncomplete = resolve;
    clear.onerror = () => reject(clear.error);
  });
  await replaceDatabase(database, restoredPayload);

  const restored = await repository.getProjectTraceability('project_vertical');
  assert.deepEqual(
    restored.artifacts.map(item => item.id).sort(),
    initial.artifacts.map(item => item.id).sort()
  );
  assert.deepEqual(
    restored.relations.map(item => [item.fromId, item.toId, item.type]).sort(),
    initial.relations.map(item => [item.fromId, item.toId, item.type]).sort()
  );
  assert.equal(restored.documents[0].text, 'Resultado verificable');
  database.close();
});

test('un respaldo v1 se convierte en memoria sin modificar el original', () => {
  const original = {
    version: 1,
    subjects: [{ id: 'subject_v1', name: 'Legado' }],
    documents: [],
    cards: [],
    attempts: [],
    settings: []
  };
  const restored = validateBackup(original);
  assert.equal(restored.version, 2);
  assert.deepEqual(restored.academicProjects, []);
  assert.equal(original.version, 1);
  assert.equal(Object.hasOwn(original, 'academicProjects'), false);
});

test('un respaldo v2 no puede saltarse la integridad académica', async () => {
  const { database } = await testRepository('vertical-invalid');
  const invalid = {
    version: 2,
    subjects: [{ id: 'subject_one', name: 'Metodología' }],
    documents: [],
    cards: [],
    attempts: [],
    settings: [],
    academicProjects: [makeGraph('project_invalid', 'subject_one').project],
    projectArtifacts: [
      {
        ...makeGraph('project_invalid', 'subject_one').artifacts[1],
        data: { documentId: 'document_missing', role: 'source_file' }
      }
    ],
    artifactRelations: [],
    artifactRevisions: []
  };
  await assert.rejects(() => replaceDatabase(database, invalid), /documento inexistente/);
  const subjectRequest = database.transaction('subjects').objectStore('subjects').getAll();
  const subjects = await new Promise((resolve, reject) => {
    subjectRequest.onsuccess = () => resolve(subjectRequest.result);
    subjectRequest.onerror = () => reject(subjectRequest.error);
  });
  assert.deepEqual(subjects.map(item => item.id).sort(), ['subject_one', 'subject_two']);
  database.close();
});
