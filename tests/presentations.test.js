import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFile } from 'node:fs/promises';
import {
  buildNexusPackage,
  makePresentationBundle
} from '../js/academic/presentation-model.js';
import { exportDatabase, replaceDatabase } from '../js/db.js';
import { makeGraph, testRepository } from './academic-fixtures.js';

function ids(seed) {
  let sequence = 0;
  return key => `${key.split(':')[0]}_${seed}_${sequence++}`;
}

function slide(projectId, title = 'Resultados') {
  return {
    title,
    content: 'Hallazgos principales.',
    speakerNotes: 'Explicar la medición.',
    state: 'draft',
    sectionIds: [`${projectId}_section`],
    evidenceIds: [`${projectId}_evidence`],
    sourceIds: [`${projectId}_source`]
  };
}

function presentation(seed, projectId, slides, overrides = {}, existing = null) {
  return makePresentationBundle({
    projectId,
    title: 'Defensa del proyecto',
    objective: 'Presentar resultados verificables.',
    audience: 'Comisión',
    state: 'draft',
    slides,
    ...overrides
  }, {
    existing,
    ids: ids(seed),
    now: new Date('2026-07-26T12:00:00.000Z')
  });
}

async function context(name, projectId = 'project_presentation') {
  const result = await testRepository(name);
  await result.repository.createGraph(makeGraph(projectId, 'subject_one'));
  return result;
}

test('crea, edita y ordena diapositivas con trazabilidad', async () => {
  const projectId = 'project_presentation';
  const { database, repository } = await context('presentation-crud', projectId);
  const api = repository.presentations();
  const created = await api.save(presentation('crud', projectId, [
    slide(projectId), slide(projectId, 'Conclusiones')
  ]));
  assert.equal(created.slides.length, 2);
  assert.equal(created.relations.length, 6);
  const values = created.slides.map(item => ({
    id: item.id,
    ...slide(projectId, item.title),
    content: item.data.content,
    speakerNotes: item.data.speakerNotes,
    state: item.status
  })).reverse();
  values[0].state = 'ready';
  const updated = await api.save(
    presentation('unused', projectId, values, { state: 'ready' }, created),
    { existing: true }
  );
  assert.equal(updated.slides[0].title, 'Conclusiones');
  assert.equal(updated.slides[0].status, 'ready');
  database.close();
});

test('rechaza títulos, estados y relaciones duplicadas', () => {
  const projectId = 'project_validation';
  assert.throws(
    () => presentation('title', projectId, [{ ...slide(projectId), title: '' }]),
    /title es incorrecto/
  );
  assert.throws(
    () => presentation('state', projectId, [slide(projectId)], { state: 'published' }),
    /estado/
  );
  assert.throws(
    () => presentation('duplicate', projectId, [{
      ...slide(projectId),
      sourceIds: [`${projectId}_source`, `${projectId}_source`]
    }]),
    /duplicadas/
  );
});

test('rechaza extremos inexistentes y proyectos cruzados atómicamente', async () => {
  const projectId = 'project_integrity';
  const { database, repository } = await context('presentation-integrity', projectId);
  const api = repository.presentations();
  await assert.rejects(
    () => api.save(presentation('missing', projectId, [{
      ...slide(projectId), evidenceIds: ['missing']
    }])),
    /extremo no existe/
  );
  await repository.createGraph(makeGraph('project_other', 'subject_two'));
  await assert.rejects(
    () => api.save(presentation('cross', projectId, [{
      ...slide(projectId), sourceIds: ['project_other_source']
    }])),
    /mismo proyecto/
  );
  assert.equal(await api.get(projectId), null);
  database.close();
});

test('eliminar presentación conserva informe, secciones, fuentes y evidencias', async () => {
  const projectId = 'project_delete_presentation';
  const { database, repository } = await context('presentation-delete', projectId);
  const api = repository.presentations();
  const created = await api.save(presentation('delete', projectId, [slide(projectId)]));
  await api.delete(created.presentation.id);
  const trace = await repository.getProjectTraceability(projectId);
  assert.equal(await api.get(projectId), null);
  ['report', 'report_section', 'source', 'evidence'].forEach(kind =>
    assert.ok(trace.artifacts.some(item => item.kind === kind))
  );
  database.close();
});

test('respaldo y restauración conservan presentación y relaciones', async () => {
  const projectId = 'project_backup_presentation';
  const { database, repository } = await context('presentation-backup', projectId);
  const api = repository.presentations();
  const created = await api.save(presentation('backup', projectId, [slide(projectId)]));
  const backup = await exportDatabase(database);
  await api.delete(created.presentation.id);
  await replaceDatabase(database, backup);
  const restored = await api.get(projectId);
  assert.equal(restored.slides.length, 1);
  assert.equal(restored.relations.length, 3);
  database.close();
});

test('el paquete NEXUS es local, versionado y conserva vínculos', async () => {
  const projectId = 'project_package';
  const { database, repository } = await context('presentation-package', projectId);
  const details = await repository.presentations().save(
    presentation('package', projectId, [slide(projectId)])
  );
  const project = await repository.getProject(projectId);
  const payload = buildNexusPackage(project, details);
  assert.equal(payload.format, 'forja-nexus-package');
  assert.equal(payload.version, 1);
  assert.equal(payload.slides[0].links.length, 3);
  assert.doesNotMatch(JSON.stringify(payload), /password|token|recovery/i);
  database.close();
});

test('consulta 500 diapositivas ordenadas mediante parentId', async () => {
  const projectId = 'project_performance_presentation';
  const { database, repository } = await context('presentation-performance', projectId);
  const slides = Array.from({ length: 500 }, (_, index) => ({
    ...slide(projectId, `Diapositiva ${index}`),
    sectionIds: [], evidenceIds: [], sourceIds: []
  }));
  const start = performance.now();
  await repository.presentations().save(presentation('performance', projectId, slides));
  const result = await repository.presentations().get(projectId);
  const elapsed = performance.now() - start;
  console.log(`Métrica presentaciones FORJA: 500 diapositivas=${elapsed.toFixed(1)}ms`);
  assert.equal(result.slides.length, 500);
  assert.ok(elapsed < 1200);
  database.close();
});

test('la interfaz usa AcademicRepository y no implementa el motor de NEXUS', async () => {
  const files = await Promise.all([
    readFile(new URL('../js/presentations/presentations-controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/presentations/presentation-view.js', import.meta.url), 'utf8')
  ]);
  const code = files.join('\n');
  assert.match(code, /new AcademicRepository\(\)/);
  assert.doesNotMatch(code, /indexedDB|objectStore\(|getUserMedia|gesture|WebRTC/);
  assert.match(code, /buildNexusPackage/);
});
