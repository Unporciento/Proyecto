import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { AcademicRepository } from '../js/academic/academic-repository.js';
import {
  DATA,
  makeArtifact,
  makeProject,
  makeRelation,
  testRepository
} from './academic-fixtures.js';

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function volumeGraph(projectIndex) {
  const projectId = `volume_project_${projectIndex}`;
  const project = makeProject(projectId, 'subject_one');
  const artifacts = [];
  for (let index = 0; index < 50; index += 1) {
    artifacts.push(makeArtifact(`${projectId}_source_${index}`, projectId, 'source', DATA.source));
  }
  for (let index = 0; index < 25; index += 1) {
    artifacts.push(makeArtifact(`${projectId}_evidence_${index}`, projectId, 'evidence', DATA.evidence));
  }
  artifacts.push(makeArtifact(`${projectId}_report`, projectId, 'report', DATA.report));
  for (let index = 0; index < 24; index += 1) {
    artifacts.push(makeArtifact(
      `${projectId}_section_${index}`,
      projectId,
      'report_section',
      DATA.section,
      `${projectId}_report`
    ));
  }
  const relations = [];
  for (let evidence = 0; evidence < 25; evidence += 1) {
    for (let offset = 0; offset < 10; offset += 1) {
      const section = (evidence + offset) % 24;
      relations.push(makeRelation(
        `${projectId}_relation_${evidence}_${offset}`,
        projectId,
        `${projectId}_evidence_${evidence}`,
        `${projectId}_section_${section}`,
        'supports'
      ));
    }
  }
  return { project, artifacts, relations };
}

test('consulta indexada con 200 proyectos, 20 000 artefactos y 50 000 relaciones', async () => {
  const { database } = await testRepository('academic-volume');
  const seedStarted = performance.now();
  for (let projectIndex = 0; projectIndex < 200; projectIndex += 1) {
    const graph = volumeGraph(projectIndex);
    const tx = database.transaction(
      ['academicProjects', 'projectArtifacts', 'artifactRelations'],
      'readwrite'
    );
    tx.objectStore('academicProjects').add(graph.project);
    graph.artifacts.forEach(item => tx.objectStore('projectArtifacts').add(item));
    graph.relations.forEach(item => tx.objectStore('artifactRelations').add(item));
    await transactionDone(tx);
  }
  const seedMs = performance.now() - seedStarted;

  const repository = new AcademicRepository(async () => database);
  const queryStarted = performance.now();
  const trace = await repository.getProjectTraceability('volume_project_137');
  const queryMs = performance.now() - queryStarted;

  assert.equal(trace.artifacts.length, 100);
  assert.equal(trace.relations.length, 250);
  assert.ok(seedMs < 20_000, `la carga de volumen tardó ${seedMs.toFixed(1)} ms`);
  assert.ok(queryMs < 2_000, `la consulta indexada tardó ${queryMs.toFixed(1)} ms`);
  console.log(`Métrica FORJA: carga=${seedMs.toFixed(1)}ms, consulta=${queryMs.toFixed(1)}ms`);
  database.close();
});

