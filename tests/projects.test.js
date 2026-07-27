import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFile } from 'node:fs/promises';
import { AcademicRepository } from '../js/academic/academic-repository.js';
import { exportDatabase, replaceDatabase } from '../js/db.js';
import {
  PROJECT_SCHEMA_VERSION,
  makeProjectRecord,
  validateProject
} from '../js/academic/project-model.js';
import { makeGraph, testRepository } from './academic-fixtures.js';

const INPUT = Object.freeze({
  title: 'Diagnóstico de transmisión',
  subjectId: 'subject_one',
  professor: 'Sergio Chislenko',
  semester: 'Segundo semestre 2026',
  startDate: '2026-07-26',
  dueDate: '2026-08-30',
  status: 'active',
  description: 'Proyecto de diagnóstico técnico.',
  color: '#b9ef73',
  icon: 'wrench',
  progress: 20
});

function record(id, overrides = {}) {
  return makeProjectRecord(
    { ...INPUT, ...overrides },
    { id, now: new Date('2026-07-26T12:00:00.000Z') }
  );
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

test('el contrato visible valida campos, fechas y estados cerrados', () => {
  const project = record('project_contract');
  assert.equal(project.schemaVersion, PROJECT_SCHEMA_VERSION);
  assert.equal(validateProject(project), true);
  assert.throws(() => record('empty', { title: '   ' }), /title/);
  assert.throws(
    () => record('dates', { startDate: '2026-09-01', dueDate: '2026-08-01' }),
    /fecha de entrega/
  );
  assert.throws(() => record('status', { status: 'personalizado' }), /status/);
  assert.throws(() => record('progress', { progress: 101 }), /progress/);
  assert.throws(() => record('progress-empty', { progress: '' }), /progress/);
  assert.throws(() => record('icon', { icon: 'script' }), /icon/);
});

test('crear, editar, archivar, listar y eliminar usa el repositorio académico', async () => {
  const { database, repository } = await testRepository('projects-crud');
  const created = await repository.createProject(record('project_crud'));
  assert.equal(created.title, INPUT.title);

  const updated = makeProjectRecord(
    { ...INPUT, title: 'Transmisión actualizada', progress: 65 },
    { existing: created, now: new Date('2026-07-27T12:00:00.000Z') }
  );
  await repository.updateProject(updated);
  assert.equal((await repository.getProject(created.id)).progress, 65);

  const archived = await repository.archiveProject(
    created.id,
    new Date('2026-07-28T12:00:00.000Z')
  );
  assert.equal(archived.status, 'archived');
  assert.ok(archived.archivedAt);
  assert.equal((await repository.listProjects({ status: 'archived' })).length, 1);

  const backup = await exportDatabase(database);
  assert.equal(backup.version, 2);
  assert.equal(backup.academicProjects[0].schemaVersion, 2);
  await repository.deleteProject(created.id);
  await assert.rejects(() => repository.getProject(created.id), /no existe/);
  await replaceDatabase(database, backup);
  assert.equal((await repository.getProject(created.id)).color, '#b9ef73');
  await repository.deleteProject(created.id);
  database.close();
});

test('rechaza proyectos duplicados dentro de la misma asignatura', async () => {
  const { database, repository } = await testRepository('projects-duplicate');
  await repository.createProject(record('project_first'));
  await assert.rejects(
    () => repository.createProject(record('project_second', {
      title: '  DIAGNÓSTICO   DE TRANSMISIÓN '
    })),
    /ya existe/
  );
  const editable = await repository.createProject(record('project_editable', {
    title: 'Proyecto diferente'
  }));
  const duplicateUpdate = makeProjectRecord(
    { ...INPUT, title: 'DIAGNÓSTICO DE TRANSMISIÓN' },
    { existing: editable, now: new Date('2026-07-27T12:00:00.000Z') }
  );
  await assert.rejects(() => repository.updateProject(duplicateUpdate), /ya existe/);
  await repository.createProject(record('project_other_subject', {
    subjectId: 'subject_two'
  }));
  database.close();
});

test('eliminar un proyecto limpia su grafo sin tocar documentos ni asignaturas', async () => {
  const { database, repository } = await testRepository('projects-cascade');
  const graph = makeGraph('project_delete', 'subject_one');
  await repository.createGraph(graph);
  await repository.deleteProject(graph.project.id);

  for (const store of [
    'academicProjects', 'projectArtifacts', 'artifactRelations', 'artifactRevisions'
  ]) {
    const rows = await requestResult(database.transaction(store).objectStore(store).getAll());
    assert.equal(rows.length, 0, `${store} conserva datos eliminados`);
  }
  const documents = await requestResult(
    database.transaction('documents').objectStore('documents').getAll()
  );
  assert.equal(documents.length, 1);
  database.close();
});

test('consulta paginada 500 proyectos mediante el índice updatedAt', async () => {
  const { database } = await testRepository('projects-volume');
  const transaction = database.transaction('academicProjects', 'readwrite');
  const store = transaction.objectStore('academicProjects');
  for (let index = 0; index < 500; index += 1) {
    store.add(record(`project_${index}`, {
      title: `Proyecto ${index}`,
      status: index % 5 === 0 ? 'archived' : 'active'
    }));
  }
  await transactionDone(transaction);

  const repository = new AcademicRepository(async () => database);
  const started = performance.now();
  const firstPage = await repository.listProjects({ limit: 60 });
  const secondPage = await repository.listProjects({ limit: 60, offset: 60 });
  const archived = await repository.listProjects({ status: 'archived', limit: 100 });
  const elapsed = performance.now() - started;

  assert.equal(firstPage.length, 60);
  assert.equal(secondPage.length, 60);
  assert.equal(new Set([...firstPage, ...secondPage].map(item => item.id)).size, 120);
  assert.equal(archived.length, 100);
  assert.ok(elapsed < 1_000, `la consulta de proyectos tardó ${elapsed.toFixed(1)} ms`);
  console.log(`Métrica proyectos FORJA: 500 registros, páginas y filtro=${elapsed.toFixed(1)}ms`);
  database.close();
});

test('la interfaz es accesible y no usa IndexedDB directamente', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const controller = await readFile(
    new URL('../js/projects/projects-controller.js', import.meta.url),
    'utf8'
  );
  assert.match(html, /data-view="proyectos"/);
  assert.match(html, /aria-labelledby="projectsTitle"/);
  assert.match(html, /id="projectFormError" role="alert"/);
  assert.match(controller, /new AcademicRepository/);
  assert.doesNotMatch(controller, /indexedDB|from ['"].*\/db\.js/);
});
