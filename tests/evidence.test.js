import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFile } from 'node:fs/promises';
import { AcademicRepository } from '../js/academic/academic-repository.js';
import {
  ACADEMIC_DB_VERSION,
  openCompatibleDatabase
} from '../js/academic/academic-migrations.js';
import { makeEvidenceBundle } from '../js/academic/evidence-model.js';
import { makeSourceBundle } from '../js/academic/source-model.js';
import { makeCriterion, makeRubricBundle } from '../js/academic/rubric-model.js';
import { exportDatabase, replaceDatabase } from '../js/db.js';
import { makeProject, testRepository } from './academic-fixtures.js';

const INPUT = Object.freeze({
  projectId: 'project_evidence',
  title: 'Medición de presión',
  evidenceType: 'photo',
  description: 'Demuestra la presión registrada durante la prueba.',
  observation: 'Motor a temperatura de servicio.',
  date: '2026-07-26',
  state: 'collected',
  documentId: 'document_one',
  sourceIds: ['source_evidence'],
  criterionIds: ['criterion_evidence']
});

function idFactory(seed) {
  let sequence = 0;
  return key => `${key.split(':')[0]}_${seed}_${sequence++}`;
}

function evidence(seed, overrides = {}, existing = null) {
  return makeEvidenceBundle({ ...INPUT, ...overrides }, {
    existing,
    ids: idFactory(seed),
    now: new Date('2026-07-26T12:00:00.000Z')
  });
}

async function context(name) {
  const result = await testRepository(name);
  await result.repository.createProject(makeProject('project_evidence', 'subject_one'));
  await result.repository.createSourceBundle(makeSourceBundle({
    projectId: 'project_evidence',
    title: 'Manual del fabricante',
    sourceType: 'article',
    description: 'Procedimiento de prueba.',
    author: 'Fabricante',
    date: '',
    url: '',
    notes: '',
    documentId: ''
  }, {
    ids: { sourceId: 'source_evidence' },
    now: new Date('2026-07-26T12:00:00.000Z')
  }));
  const criterion = makeCriterion({
    title: 'Verificación técnica',
    description: 'Presenta una medición verificable.',
    maxPoints: 25,
    required: true,
    state: 'pending'
  }, {
    projectId: 'project_evidence',
    rubricId: 'rubric_evidence',
    id: 'criterion_evidence',
    position: 0,
    now: new Date('2026-07-26T12:00:00.000Z')
  });
  await result.repository.createRubricBundle(makeRubricBundle({
    title: 'Rúbrica técnica',
    instructions: '',
    observations: ''
  }, [criterion], {
    projectId: 'project_evidence',
    id: 'rubric_evidence',
    now: new Date('2026-07-26T12:00:00.000Z')
  }));
  return result;
}

test('crea y edita evidencia con fuente, criterio y documento atómicos', async () => {
  const { database, repository } = await context('evidence-crud');
  const created = await repository.createEvidenceBundle(evidence('crud'));
  assert.equal(created.document.id, 'document_one');
  assert.deepEqual(
    created.relations.map(item => item.type).sort(),
    ['attached_to', 'derived_from', 'satisfies']
  );
  const changed = evidence('ignored', {
    evidenceType: 'technical_result',
    documentId: '',
    state: 'approved',
    observation: 'Resultado confirmado.'
  }, created);
  const updated = await repository.updateEvidenceBundle(changed);
  assert.equal(updated.evidence.data.state, 'approved');
  assert.equal(updated.document, null);
  assert.deepEqual(
    updated.relations.map(item => item.type).sort(),
    ['derived_from', 'satisfies']
  );
  database.close();
});

test('rechaza tipos, estados, relaciones duplicadas y autorrelaciones', () => {
  assert.throws(
    () => evidence('type', { evidenceType: 'inventada', documentId: '' }),
    /evidenceType no está permitido/
  );
  assert.throws(
    () => evidence('state', { state: 'inventado' }),
    /state no está permitido/
  );
  assert.throws(
    () => evidence('duplicate', {
      sourceIds: ['source_evidence', 'source_evidence']
    }),
    /duplicadas/
  );
  const selfId = 'evidence_self_0';
  assert.throws(
    () => evidence('self', {
      evidenceType: 'text',
      documentId: '',
      sourceIds: [selfId]
    }),
    /autorrelaciones/
  );
  assert.throws(
    () => evidence('missing-source', { sourceIds: [] }),
    /al menos una fuente/
  );
  assert.throws(
    () => evidence('missing-criterion', { criterionIds: [] }),
    /al menos un criterio/
  );
});

test('rechaza fuentes, criterios y documentos inexistentes sin cambios parciales', async () => {
  const { database, repository } = await context('evidence-missing');
  await assert.rejects(
    () => repository.createEvidenceBundle(evidence('source', {
      sourceIds: ['source_missing']
    })),
    /extremo no existe/
  );
  await assert.rejects(
    () => repository.createEvidenceBundle(evidence('criterion', {
      criterionIds: ['criterion_missing']
    })),
    /extremo no existe/
  );
  await assert.rejects(
    () => repository.createEvidenceBundle(evidence('document', {
      documentId: 'document_missing'
    })),
    /documento referenciado no existe/
  );
  assert.equal(
    (await repository.listEvidenceSummaries('project_evidence')).length,
    0
  );
  database.close();
});

test('impide relaciones entre proyectos distintos', async () => {
  const { database, repository } = await context('evidence-cross-project');
  await repository.createProject(makeProject('project_other', 'subject_two'));
  await repository.createSourceBundle(makeSourceBundle({
    projectId: 'project_other',
    title: 'Fuente ajena',
    sourceType: 'article',
    description: '',
    author: '',
    date: '',
    url: '',
    notes: '',
    documentId: ''
  }, { ids: { sourceId: 'source_other' } }));
  await assert.rejects(
    () => repository.createEvidenceBundle(evidence('cross', {
      sourceIds: ['source_other']
    })),
    /mismo proyecto/
  );
  database.close();
});

test('eliminar evidencia conserva documento, fuente, criterio y rúbrica', async () => {
  const { database, repository } = await context('evidence-delete');
  const created = await repository.createEvidenceBundle(evidence('delete'));
  await repository.deleteEvidence(created.evidence.id);
  await assert.rejects(
    () => repository.getEvidenceDetails(created.evidence.id),
    /no existe/
  );
  const trace = await repository.getProjectTraceability('project_evidence');
  const document = await new Promise((resolve, reject) => {
    const request = database.transaction('documents').objectStore('documents')
      .get('document_one');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  assert.equal(document.id, 'document_one');
  assert.ok(trace.artifacts.some(item => item.id === 'source_evidence'));
  assert.ok(trace.artifacts.some(item => item.id === 'criterion_evidence'));
  assert.ok(trace.artifacts.some(item => item.id === 'rubric_evidence'));
  database.close();
});

test('respaldo, restauración, trazabilidad y reapertura conservan relaciones', async () => {
  const { database, factory, name, repository } = await context('evidence-backup');
  const created = await repository.createEvidenceBundle(evidence('backup'));
  const before = await repository.getProjectTraceability('project_evidence');
  assert.ok(before.relations.some(item =>
    item.fromId === created.evidence.id
    && item.toId === 'source_evidence'
    && item.type === 'derived_from'
  ));
  assert.ok(before.relations.some(item =>
    item.fromId === created.evidence.id
    && item.toId === 'criterion_evidence'
    && item.type === 'satisfies'
  ));
  const backup = await exportDatabase(database);
  await repository.deleteEvidence(created.evidence.id);
  await replaceDatabase(database, backup);
  assert.equal(
    (await repository.getEvidenceDetails(created.evidence.id)).relations.length,
    3
  );
  database.close();

  const reopened = await openCompatibleDatabase({
    name,
    factory,
    targetVersion: ACADEMIC_DB_VERSION
  });
  const reopenedRepository = new AcademicRepository(async () => reopened);
  assert.equal(
    (await reopenedRepository.listEvidenceSummaries('project_evidence'))[0]
      .criterionIds[0],
    'criterion_evidence'
  );
  reopened.close();
});

test('consulta y filtra 500 evidencias con trazabilidad indexada', async () => {
  const { database, repository } = await context('evidence-volume');
  const tx = database.transaction(['projectArtifacts', 'artifactRelations'], 'readwrite');
  const artifacts = tx.objectStore('projectArtifacts');
  const relations = tx.objectStore('artifactRelations');
  for (let index = 0; index < 500; index += 1) {
    const item = evidence(`volume_${index}`, {
      evidenceType: index % 5 === 0 ? 'calculation' : 'finding',
      documentId: '',
      state: index % 5 === 0 ? 'approved' : 'collected',
      title: `Evidencia ${index}`
    });
    artifacts.add(item.evidence);
    item.relations.forEach(relation => relations.add(relation));
  }
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  const started = performance.now();
  const first = await repository.listEvidenceSummaries('project_evidence', { limit: 60 });
  const approved = await repository.listEvidenceSummaries('project_evidence', {
    state: 'approved',
    evidenceType: 'calculation',
    limit: 100
  });
  const elapsed = performance.now() - started;
  assert.equal(first.length, 60);
  assert.equal(approved.length, 100);
  assert.ok(first.every(item => item.sourceIds.length === 1 && item.criterionIds.length === 1));
  const limitMs = process.platform === 'win32' ? 2_500 : 1_000;
  assert.ok(elapsed < limitMs, `las evidencias tardaron ${elapsed.toFixed(1)} ms`);
  console.log(`Métrica evidencias FORJA: 500 registros=${elapsed.toFixed(1)}ms`);
  database.close();
});

test('la interfaz de evidencias usa el repositorio y expone trazabilidad accesible', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const controller = await readFile(
    new URL('../js/evidence/evidence-controller.js', import.meta.url),
    'utf8'
  );
  const view = await readFile(
    new URL('../js/evidence/evidence-view.js', import.meta.url),
    'utf8'
  );
  assert.match(html, /id="evidenceWorkspace"/);
  assert.match(html, /id="evidenceFormError" role="alert"/);
  assert.match(controller, /new AcademicRepository/);
  assert.doesNotMatch(controller, /indexedDB|from ['"].*\/db\.js/);
  assert.match(view, /Fuente →/);
  assert.match(view, /Satisface →/);
});
