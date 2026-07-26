import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DATA,
  makeArtifact,
  makeGraph,
  makeProject,
  makeRelation,
  testRepository
} from './academic-fixtures.js';
import * as legacyDb from '../js/db.js';

test('la API genérica heredada no permite escribir stores académicos', async () => {
  await assert.rejects(
    () => legacyDb.put('academicProjects', makeProject()),
    /solo se gestionan mediante su repositorio/
  );
});

test('el repositorio exige proyecto, documento, padre y proyecto común', async () => {
  const { database, repository } = await testRepository('repo-integrity');
  await assert.rejects(
    () => repository.createProject(makeProject('project_missing', 'subject_missing')),
    /asignatura no existe/
  );
  await assert.rejects(
    () => repository.createArtifact(
      makeArtifact('evidence_orphan', 'project_missing', 'evidence', DATA.evidence)
    ),
    /proyecto no existe/
  );

  await repository.createProject(makeProject('project_one'));
  await assert.rejects(
    () => repository.createArtifact(
      makeArtifact('docref_missing', 'project_one', 'document_ref', {
        documentId: 'document_missing', role: 'source_file'
      })
    ),
    /documento referenciado no existe/
  );
  await repository.createArtifact(makeArtifact('rubric_one', 'project_one', 'rubric', DATA.rubric));
  await repository.createArtifact(makeArtifact('report_one', 'project_one', 'report', DATA.report));
  await assert.rejects(
    () => repository.createArtifact(
      makeArtifact('criterion_wrong', 'project_one', 'rubric_criterion', DATA.criterion, 'report_one')
    ),
    /debe pertenecer a rubric/
  );
  await assert.rejects(
    () => repository.createArtifact(
      makeArtifact('section_wrong', 'project_one', 'report_section', DATA.section, 'rubric_one')
    ),
    /debe pertenecer a report/
  );
  database.close();
});

test('el repositorio rechaza relaciones cruzadas, duplicadas y autorrelaciones', async () => {
  const { database, repository } = await testRepository('repo-relations');
  const first = makeGraph('project_one', 'subject_one');
  const second = makeGraph('project_two', 'subject_two');
  second.artifacts[1] = makeArtifact(
    'project_two_docref',
    'project_two',
    'document_ref',
    DATA.documentRef
  );
  await repository.createGraph(first);
  await repository.createGraph(second);
  const cross = makeRelation(
    'relation_cross',
    'project_one',
    'project_one_evidence',
    'project_two_criterion',
    'satisfies'
  );
  await assert.rejects(() => repository.createRelation(cross), /mismo proyecto/);
  const duplicate = makeRelation(
    'relation_duplicate',
    'project_one',
    'project_one_evidence',
    'project_one_criterion',
    'satisfies'
  );
  await assert.rejects(() => repository.createRelation(duplicate), /ya existe/);
  const self = makeRelation(
    'relation_self',
    'project_one',
    'project_one_evidence',
    'project_one_evidence',
    'supports'
  );
  await assert.rejects(() => repository.createRelation(self), /autorrelaciones/);
  database.close();
});

test('un fallo intermedio aborta el grafo completo', async () => {
  const { database, repository } = await testRepository('repo-atomic');
  const graph = makeGraph('project_atomic', 'subject_one');
  graph.relations[1] = {
    ...graph.relations[1],
    id: graph.relations[0].id
  };
  await assert.rejects(() => repository.createGraph(graph));
  const tx = database.transaction(
    ['academicProjects', 'projectArtifacts', 'artifactRelations'],
    'readonly'
  );
  const count = store => new Promise((resolve, reject) => {
    const request = tx.objectStore(store).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  assert.deepEqual(
    await Promise.all(['academicProjects', 'projectArtifacts', 'artifactRelations'].map(count)),
    [0, 0, 0]
  );
  database.close();
});
