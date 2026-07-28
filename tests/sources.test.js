import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFile } from 'node:fs/promises';
import { exportDatabase, replaceDatabase } from '../js/db.js';
import { makeSourceBundle } from '../js/academic/source-model.js';
import { makeProject, testRepository } from './academic-fixtures.js';

const INPUT = Object.freeze({
  projectId: 'project_sources',
  title: 'Manual de transmisión',
  sourceType: 'pdf',
  description: 'Manual técnico del fabricante.',
  documentId: 'document_one',
  url: '',
  author: 'Fabricante',
  date: '2026-07-26',
  notes: 'Revisar capítulo cuatro.'
});

function bundle(id, overrides = {}, existing = null) {
  return makeSourceBundle(
    { ...INPUT, ...overrides },
    {
      existing,
      ids: {
        sourceId: `source_${id}`,
        referenceId: `reference_${id}`,
        relationId: `relation_${id}`
      },
      now: new Date('2026-07-26T12:00:00.000Z')
    }
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

async function sourceRepository(name) {
  const context = await testRepository(name);
  await context.repository.createProject(makeProject('project_sources', 'subject_one'));
  return context;
}

test('el contrato de fuente valida tipos, documentos y enlaces seguros', () => {
  assert.equal(bundle('valid').source.schemaVersion, 2);
  assert.throws(
    () => bundle('file', { documentId: '' }),
    /necesita un documento/
  );
  assert.throws(
    () => bundle('web', { sourceType: 'website', documentId: '', url: '' }),
    /url es obligatoria/
  );
  assert.throws(
    () => bundle('unsafe', {
      sourceType: 'website', documentId: '', url: 'javascript:alert(1)'
    }),
    /protocolo no permitido/
  );
  assert.throws(
    () => bundle('unknown', { sourceType: 'audio', documentId: '' }),
    /sourceType no está permitido/
  );
});

test('crea, edita y restaura una fuente con referencia documental atómica', async () => {
  const { database, repository } = await sourceRepository('sources-crud');
  const created = await repository.createSourceBundle(bundle('crud'));
  assert.equal(created.document.id, 'document_one');
  assert.equal(created.relation.type, 'attached_to');
  assert.equal((await repository.listSources('project_sources')).length, 1);

  const changed = bundle('ignored', {
    sourceType: 'website',
    documentId: '',
    url: 'https://example.com/manual',
    title: 'Manual en línea'
  }, created);
  const updated = await repository.updateSourceBundle(changed);
  assert.equal(updated.source.title, 'Manual en línea');
  assert.equal(updated.reference, null);
  assert.equal(updated.document, null);

  const backup = await exportDatabase(database);
  assert.equal(backup.projectArtifacts.length, 1);
  await repository.deleteSource(updated.source.id);
  await replaceDatabase(database, backup);
  assert.equal(
    (await repository.getSourceDetails(updated.source.id)).source.data.url,
    'https://example.com/manual'
  );
  database.close();
});

test('un documento inexistente aborta la fuente completa', async () => {
  const { database, repository } = await sourceRepository('sources-atomic');
  await assert.rejects(
    () => repository.createSourceBundle(bundle('missing', {
      documentId: 'document_missing'
    })),
    /documento referenciado no existe/
  );
  const artifacts = await requestResult(
    database.transaction('projectArtifacts').objectStore('projectArtifacts').getAll()
  );
  const relations = await requestResult(
    database.transaction('artifactRelations').objectStore('artifactRelations').getAll()
  );
  assert.deepEqual([artifacts.length, relations.length], [0, 0]);
  database.close();
});

test('una fuente no puede cambiar de proyecto durante la edición', async () => {
  const { database, repository } = await sourceRepository('sources-project-boundary');
  await repository.createProject(makeProject('project_other', 'subject_two'));
  const created = await repository.createSourceBundle(bundle('boundary'));
  const moved = bundle('ignored', {
    projectId: 'project_other',
    documentId: '',
    sourceType: 'note'
  }, created);
  await assert.rejects(
    () => repository.updateSourceBundle(moved),
    /no puede cambiar de proyecto/
  );
  assert.equal((await repository.getSourceDetails(created.source.id)).source.projectId, 'project_sources');
  database.close();
});

test('eliminar una fuente conserva el documento de la Biblioteca', async () => {
  const { database, repository } = await sourceRepository('sources-delete');
  const created = await repository.createSourceBundle(bundle('delete'));
  await repository.deleteSource(created.source.id);
  await assert.rejects(() => repository.getSourceDetails(created.source.id), /no existe/);
  const document = await requestResult(
    database.transaction('documents').objectStore('documents').get('document_one')
  );
  assert.equal(document.text, 'Resultado verificable');
  assert.equal((await repository.listSources('project_sources')).length, 0);
  database.close();
});

test('consulta 500 fuentes con paginación y filtro indexado', async () => {
  const { database, repository } = await sourceRepository('sources-volume');
  const transaction = database.transaction('projectArtifacts', 'readwrite');
  const store = transaction.objectStore('projectArtifacts');
  for (let index = 0; index < 500; index += 1) {
    store.add(bundle(`volume_${index}`, {
      sourceType: index % 5 === 0 ? 'video' : 'article',
      documentId: '',
      url: index % 5 === 0 ? `https://example.com/video/${index}` : '',
      title: `Fuente ${index}`
    }).source);
  }
  await transactionDone(transaction);

  const started = performance.now();
  const first = await repository.listSources('project_sources', { limit: 60 });
  const second = await repository.listSources('project_sources', { limit: 60, offset: 60 });
  const videos = await repository.listSources('project_sources', {
    sourceType: 'video', limit: 100
  });
  const elapsed = performance.now() - started;
  assert.equal(first.length, 60);
  assert.equal(second.length, 60);
  assert.equal(new Set([...first, ...second].map(item => item.id)).size, 120);
  assert.equal(videos.length, 100);
  const limitMs = process.platform === 'win32' ? 1_500 : 1_000;
  assert.ok(elapsed < limitMs, `la consulta de fuentes tardó ${elapsed.toFixed(1)} ms`);
  console.log(`Métrica fuentes FORJA: 500 registros, páginas y filtro=${elapsed.toFixed(1)}ms`);
  database.close();
});

test('la interfaz de fuentes usa el repositorio y no IndexedDB', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const controller = await readFile(
    new URL('../js/sources/sources-controller.js', import.meta.url),
    'utf8'
  );
  assert.match(html, /id="sourceWorkspace"/);
  assert.match(html, /id="sourceFormError" role="alert"/);
  assert.match(controller, /new AcademicRepository/);
  assert.doesNotMatch(controller, /indexedDB|from ['"].*\/db\.js/);
});
