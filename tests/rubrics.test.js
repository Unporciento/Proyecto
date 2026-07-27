import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { AcademicRepository } from '../js/academic/academic-repository.js';
import {
  makeCriterion,
  makeRubricBundle
} from '../js/academic/rubric-model.js';
import {
  ACADEMIC_DB_VERSION,
  openCompatibleDatabase
} from '../js/academic/academic-migrations.js';
import { exportDatabase, replaceDatabase } from '../js/db.js';
import { makeArtifact, makeProject, makeRelation, testRepository } from './academic-fixtures.js';

const RUBRIC_INPUT = Object.freeze({
  title: 'Pauta del informe',
  instructions: 'Demostrar el procedimiento completo.',
  observations: 'Usar evidencia verificable.'
});

function criterion(id, title, maxPoints, position, overrides = {}) {
  return makeCriterion({
    title,
    description: `Descripción ${title}`,
    maxPoints,
    required: true,
    state: 'pending',
    ...overrides
  }, {
    projectId: 'project_rubric',
    rubricId: 'rubric_one',
    id,
    position,
    now: new Date('2026-07-26T12:00:00.000Z')
  });
}

function bundle(criteria, overrides = {}) {
  return makeRubricBundle(
    { ...RUBRIC_INPUT, ...overrides },
    criteria,
    {
      projectId: 'project_rubric',
      id: 'rubric_one',
      now: new Date('2026-07-26T12:00:00.000Z')
    }
  );
}

async function context(name) {
  const result = await testRepository(name);
  await result.repository.createProject(makeProject('project_rubric', 'subject_one'));
  return result;
}

test('crea, consulta y edita una rúbrica con total derivado', async () => {
  const { database, repository } = await context('rubrics-crud');
  const initial = bundle([
    criterion('criterion_a', 'Diagnóstico', 40, 0),
    criterion('criterion_b', 'Procedimiento', 60, 1)
  ]);
  const created = await repository.createRubricBundle(initial);
  assert.equal(created.rubric.data.totalPoints, 100);
  assert.deepEqual(created.criteria.map(item => item.position), [0, 1]);

  const changed = makeRubricBundle(
    { ...RUBRIC_INPUT, title: 'Pauta actualizada', observations: 'Revisada.' },
    created.criteria.map((item, position) => ({ ...item, position })),
    {
      projectId: 'project_rubric',
      existing: created.rubric,
      now: new Date('2026-07-27T12:00:00.000Z')
    }
  );
  const updated = await repository.updateRubricBundle(changed);
  assert.equal(updated.rubric.title, 'Pauta actualizada');
  assert.equal(updated.rubric.data.observations, 'Revisada.');
  database.close();
});

test('ordena, actualiza estados y elimina criterios atómicamente', async () => {
  const { database, repository } = await context('rubrics-criteria');
  const created = await repository.createRubricBundle(bundle([
    criterion('criterion_a', 'Diagnóstico', 40, 0),
    criterion('criterion_b', 'Procedimiento', 60, 1)
  ]));
  const completed = makeCriterion({
    title: 'Procedimiento',
    description: 'Descripción actualizada',
    maxPoints: 55,
    required: false,
    state: 'completed'
  }, {
    projectId: 'project_rubric',
    rubricId: created.rubric.id,
    existing: created.criteria[1],
    position: 0
  });
  const reordered = makeRubricBundle(RUBRIC_INPUT, [
    completed,
    { ...created.criteria[0], position: 1 }
  ], { projectId: 'project_rubric', existing: created.rubric });
  const saved = await repository.updateRubricBundle(reordered);
  assert.deepEqual(saved.criteria.map(item => item.id), ['criterion_b', 'criterion_a']);
  assert.equal(saved.criteria[0].data.state, 'completed');
  assert.equal(saved.rubric.data.totalPoints, 95);

  const reduced = makeRubricBundle(RUBRIC_INPUT, [saved.criteria[0]], {
    projectId: 'project_rubric',
    existing: saved.rubric
  });
  assert.equal((await repository.updateRubricBundle(reduced)).criteria.length, 1);
  database.close();
});

test('rechaza puntajes, estados, duplicados y totales inconsistentes', async () => {
  assert.throws(
    () => criterion('negative', 'Negativo', -1, 0),
    /fuera de rango/
  );
  assert.throws(
    () => criterion('text', 'Texto', 'número', 0),
    /numérico/
  );
  assert.throws(
    () => criterion('state', 'Estado', 10, 0, { state: 'inventado' }),
    /state no está permitido/
  );
  assert.throws(
    () => bundle([
      criterion('a', 'Repetido', 10, 0),
      criterion('b', ' REPETIDO ', 20, 1)
    ]),
    /duplicados/
  );
  const inconsistent = bundle([criterion('a', 'Único', 10, 0)]);
  inconsistent.rubric.data.totalPoints = 11;
  const { database, repository } = await context('rubrics-invalid-total');
  await assert.rejects(
    () => repository.createRubricBundle(inconsistent),
    /total no coincide/
  );
  assert.equal(await repository.getProjectRubric('project_rubric'), null);
  database.close();
});

test('rechaza proyectos y pertenencias incorrectas sin escritura parcial', async () => {
  const { database, repository } = await context('rubrics-integrity');
  const wrongProject = bundle([criterion('a', 'Criterio', 10, 0)]);
  wrongProject.rubric.projectId = 'project_missing';
  wrongProject.criteria[0].projectId = 'project_missing';
  await assert.rejects(
    () => repository.createRubricBundle(wrongProject),
    /proyecto no existe/
  );
  assert.equal(await repository.getProjectRubric('project_rubric'), null);

  const valid = await repository.createRubricBundle(
    bundle([criterion('criterion_bound', 'Propio', 10, 0)])
  );
  await repository.createProject(makeProject('project_other', 'subject_two'));
  const moved = makeRubricBundle(RUBRIC_INPUT, [{
    ...valid.criteria[0],
    id: 'criterion_alien'
  }], {
      projectId: 'project_rubric',
      existing: valid.rubric
  });
  moved.criteria[0].projectId = 'project_other';
  await assert.rejects(
    () => repository.updateRubricBundle(moved),
    /mismo proyecto/
  );
  database.close();
});

test('solo admite una rúbrica y elimina criterios y relaciones sin tocar evidencia', async () => {
  const { database, repository } = await context('rubrics-delete');
  const created = await repository.createRubricBundle(
    bundle([criterion('criterion_delete', 'Eliminar', 10, 0)])
  );
  await assert.rejects(
    () => repository.createRubricBundle({
      ...bundle([]),
      rubric: { ...bundle([]).rubric, id: 'rubric_second' }
    }),
    /ya tiene una rúbrica/
  );

  const evidence = makeArtifact('evidence_keep', 'project_rubric', 'evidence', {
    summary: 'Resultado', excerpt: '',
    locator: { page: null, section: '', timestamp: null },
    confidence: 'reviewed'
  });
  await repository.createArtifact(evidence);
  await repository.createRelation(
    makeRelation('relation_cleanup', 'project_rubric', evidence.id, 'criterion_delete', 'satisfies')
  );
  await repository.deleteRubric(created.rubric.id);
  assert.equal(await repository.getProjectRubric('project_rubric'), null);
  const trace = await repository.getProjectTraceability('project_rubric');
  assert.ok(trace.artifacts.some(item => item.id === evidence.id));
  assert.equal(trace.relations.length, 0);
  database.close();
});

test('respaldo, restauración y reapertura conservan la rúbrica', async () => {
  const { database, factory, name, repository } = await context('rubrics-backup');
  await repository.createRubricBundle(bundle([
    criterion('criterion_backup', 'Respaldo', 77, 0)
  ]));
  const backup = await exportDatabase(database);
  await repository.deleteRubric('rubric_one');
  await replaceDatabase(database, backup);
  assert.equal(
    (await repository.getProjectRubric('project_rubric')).rubric.data.totalPoints,
    77
  );
  database.close();

  const reopened = await openCompatibleDatabase({
    name,
    factory,
    targetVersion: ACADEMIC_DB_VERSION
  });
  const reopenedRepository = new AcademicRepository(async () => reopened);
  assert.equal(
    (await reopenedRepository.getProjectRubric('project_rubric')).criteria[0].title,
    'Respaldo'
  );
  reopened.close();
});

test('consulta 500 criterios ordenados mediante el índice parentId', async () => {
  const { database, repository } = await context('rubrics-volume');
  const criteria = Array.from({ length: 500 }, (_, index) =>
    criterion(`criterion_${index}`, `Criterio ${index}`, 1, index)
  );
  const started = performance.now();
  await repository.createRubricBundle(bundle(criteria));
  const loaded = await repository.getProjectRubric('project_rubric');
  const elapsed = performance.now() - started;
  assert.equal(loaded.criteria.length, 500);
  assert.deepEqual(loaded.criteria.map(item => item.position), criteria.map(item => item.position));
  assert.equal(loaded.rubric.data.totalPoints, 500);
  assert.ok(elapsed < 1_000, `la rúbrica tardó ${elapsed.toFixed(1)} ms`);
  console.log(`Métrica rúbricas FORJA: 500 criterios=${elapsed.toFixed(1)}ms`);
  database.close();
});

test('la interfaz de rúbricas es accesible y usa solo el repositorio', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const controller = await readFile(
    new URL('../js/rubrics/rubrics-controller.js', import.meta.url),
    'utf8'
  );
  const projectsView = await readFile(
    new URL('../js/projects/projects-view.js', import.meta.url),
    'utf8'
  );
  assert.match(html, /id="rubricWorkspace"/);
  assert.match(html, /id="rubricFormError" role="alert"/);
  assert.match(projectsView, /action\(project, 'rubric'/);
  assert.match(controller, /new AcademicRepository/);
  assert.doesNotMatch(controller, /indexedDB|from ['"].*\/db\.js/);
});
