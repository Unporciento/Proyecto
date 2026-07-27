import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFile } from 'node:fs/promises';
import { makeEvidenceBundle } from '../js/academic/evidence-model.js';
import { makeReportBundle } from '../js/academic/report-model.js';
import { makeCriterion, makeRubricBundle } from '../js/academic/rubric-model.js';
import { makeSourceBundle } from '../js/academic/source-model.js';
import { exportDatabase, replaceDatabase } from '../js/db.js';
import { makeProject, testRepository } from './academic-fixtures.js';

function ids(seed) {
  let sequence = 0;
  return key => `${key.split(':')[0]}_${seed}_${sequence++}`;
}

function report(seed, sections, overrides = {}, existing = null) {
  return makeReportBundle({
    projectId: 'project_report',
    title: 'Informe técnico',
    abstract: 'Resultados del proyecto.',
    language: 'es',
    state: 'draft',
    sections,
    ...overrides
  }, {
    existing,
    ids: ids(seed),
    now: new Date('2026-07-26T12:00:00.000Z')
  });
}

async function context(name) {
  const result = await testRepository(name);
  await result.repository.createProject(makeProject('project_report', 'subject_one'));
  await result.repository.createSourceBundle(makeSourceBundle({
    projectId: 'project_report', title: 'Manual', sourceType: 'article',
    description: '', author: '', date: '', url: '', notes: '', documentId: ''
  }, { ids: { sourceId: 'source_report' } }));
  const criterion = makeCriterion({
    title: 'Resultado', description: '', maxPoints: 30,
    required: true, state: 'pending'
  }, {
    projectId: 'project_report', rubricId: 'rubric_report',
    id: 'criterion_report', position: 0
  });
  await result.repository.createRubricBundle(makeRubricBundle({
    title: 'Rúbrica', instructions: '', observations: ''
  }, [criterion], { projectId: 'project_report', id: 'rubric_report' }));
  await result.repository.createEvidenceBundle(makeEvidenceBundle({
    projectId: 'project_report', title: 'Prueba', evidenceType: 'text',
    description: 'Demuestra el resultado.', observation: '', date: '',
    state: 'approved', documentId: '',
    sourceIds: ['source_report'], criterionIds: ['criterion_report']
  }, { ids: ids('evidence') }));
  return result;
}

function section(title = 'Resultados') {
  return {
    title,
    body: 'La evidencia demuestra el resultado.',
    evidenceIds: ['evidence_evidence_0'],
    sourceIds: ['source_report']
  };
}

test('crea, edita y ordena secciones con evidencias y fuentes', async () => {
  const { database, repository } = await context('report-crud');
  const api = repository.reports();
  const created = await api.save(report('crud', [section(), section('Conclusión')]));
  assert.equal(created.sections.length, 2);
  assert.deepEqual(
    created.relations.map(item => item.type).sort(),
    ['cites', 'cites', 'derived_from', 'derived_from']
  );
  const input = created.sections.map(item => ({
    id: item.id, title: item.title, body: item.data.body,
    evidenceIds: ['evidence_evidence_0'], sourceIds: ['source_report']
  })).reverse();
  input[0].body = 'Conclusión actualizada.';
  const updated = await api.save(
    report('unused', input, {}, created),
    { existing: true }
  );
  assert.equal(updated.sections[0].title, 'Conclusión');
  assert.equal(updated.sections[0].data.body, 'Conclusión actualizada.');
  database.close();
});

test('rechaza títulos, estados y relaciones duplicadas', () => {
  assert.throws(() => report('title', [{ ...section(), title: '' }]), /title es incorrecto/);
  assert.throws(() => report('state', [section()], { state: 'entregado' }), /estado/);
  assert.throws(
    () => report('duplicates', [{
      ...section(), sourceIds: ['source_report', 'source_report']
    }]),
    /duplicadas/
  );
});

test('rechaza extremos inexistentes y cruzados sin escritura parcial', async () => {
  const { database, repository } = await context('report-integrity');
  const api = repository.reports();
  await assert.rejects(
    () => api.save(report('missing', [{ ...section(), evidenceIds: ['missing'] }])),
    /extremo no existe/
  );
  await repository.createProject(makeProject('project_other', 'subject_two'));
  await repository.createSourceBundle(makeSourceBundle({
    projectId: 'project_other', title: 'Ajena', sourceType: 'article',
    description: '', author: '', date: '', url: '', notes: '', documentId: ''
  }, { ids: { sourceId: 'source_other' } }));
  await assert.rejects(
    () => api.save(report('cross', [{ ...section(), sourceIds: ['source_other'] }])),
    /mismo proyecto/
  );
  assert.equal(await api.get('project_report'), null);
  database.close();
});

test('autoguardados de borrador no crean historial y finalizar sí crea un hito', async () => {
  const { database, repository } = await context('report-revisions');
  const api = repository.reports();
  let details = await api.save(report('revision', [section()]));
  details = await api.save(report('unused', [{
    id: details.sections[0].id,
    ...section(),
    body: 'Texto autoguardado.'
  }], {}, details), { existing: true });
  assert.equal(details.revisions.length, 0);
  details = await api.save(report('unused', [{
    id: details.sections[0].id,
    ...section(),
    body: 'Texto final.'
  }], { state: 'final' }, details), { existing: true });
  assert.equal(details.revisions.length, 2);
  assert.ok(details.revisions.every(item => item.reason === 'submitted'));
  database.close();
});

test('eliminar informe conserva fuentes, evidencias, rúbrica y criterios', async () => {
  const { database, repository } = await context('report-delete');
  const api = repository.reports();
  const created = await api.save(report('delete', [section()]));
  await api.delete(created.report.id);
  const trace = await repository.getProjectTraceability('project_report');
  assert.equal(await api.get('project_report'), null);
  ['source', 'evidence', 'rubric', 'rubric_criterion'].forEach(kind =>
    assert.ok(trace.artifacts.some(item => item.kind === kind))
  );
  database.close();
});

test('respaldo, restauración y reapertura conservan informe e hitos', async () => {
  const { database, factory, name, repository } = await context('report-backup');
  const api = repository.reports();
  let details = await api.save(report('backup', [section()], { state: 'final' }));
  const backup = await exportDatabase(database);
  await api.delete(details.report.id);
  await replaceDatabase(database, backup);
  details = await api.get('project_report');
  assert.equal(details.sections.length, 1);
  assert.equal(details.relations.length, 2);
  assert.equal(details.revisions.length, 2);
  database.close();
  const reopened = await new Promise((resolve, reject) => {
    const request = factory.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  assert.equal(reopened.version, 3);
  reopened.close();
});

test('consulta 500 secciones ordenadas sin cargar otros proyectos', async () => {
  const { database, repository } = await context('report-performance');
  const start = performance.now();
  const sections = Array.from({ length: 500 }, (_, index) => ({
    title: `Sección ${index}`,
    body: `Contenido ${index}`,
    evidenceIds: ['evidence_evidence_0'],
    sourceIds: ['source_report']
  }));
  await repository.reports().save(report('performance', sections));
  const result = await repository.reports().get('project_report');
  const elapsed = performance.now() - start;
  console.log(`Métrica informes FORJA: 500 secciones=${elapsed.toFixed(1)}ms`);
  assert.equal(result.sections.length, 500);
  assert.ok(elapsed < 1500);
  database.close();
});

test('la interfaz usa AcademicRepository y ofrece autoguardado accesible', async () => {
  const [controller, view] = await Promise.all([
    readFile(new URL('../js/reports/reports-controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/reports/report-view.js', import.meta.url), 'utf8')
  ]);
  assert.match(controller, /new AcademicRepository\(\)/);
  assert.doesNotMatch(controller + view, /indexedDB|objectStore\(/);
  assert.match(controller, /setTimeout/);
  assert.match(view, /aria-live/);
  assert.match(view, /criterios cubiertos/);
});
