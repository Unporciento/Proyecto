import test from 'node:test';
import assert from 'node:assert/strict';
import { validateArtifact } from '../js/academic/artifact-schemas.js';
import { assertProjectSubject, validateProject } from '../js/academic/project-model.js';
import { relationKey, validateRelation } from '../js/academic/relation-model.js';

const now = '2026-07-26T12:00:00.000Z';

function project(overrides = {}) {
  return {
    id: 'project_contract', subjectId: 'subject_contract', title: 'Proyecto',
    description: '', status: 'active', schemaVersion: 1, createdAt: now,
    updatedAt: now, submittedAt: null, archivedAt: null, ...overrides
  };
}

function artifact(kind, data, overrides = {}) {
  return {
    id: `${kind}_contract`, projectId: 'project_contract', parentId: null,
    kind, title: kind, status: 'draft', position: 0, data, schemaVersion: 1,
    createdAt: now, updatedAt: now, ...overrides
  };
}

const sourceData = {
  sourceType: 'article', authors: ['Ada'], publicationTitle: 'Base',
  publisher: '', year: 2026, url: '', accessedAt: null, notes: ''
};
const sourceDataV2 = {
  sourceType: 'article', description: 'Base', author: 'Ada',
  date: '2026-07-26', url: 'https://example.com', notes: ''
};

test('los contratos académicos son cerrados, estrictos y versionados', () => {
  assert.equal(validateProject(project()), true);
  assert.equal(assertProjectSubject(project(), { id: 'subject_contract' }), true);
  assert.equal(validateArtifact(artifact('source', sourceData)), true);
  assert.equal(
    validateArtifact(artifact('source', sourceDataV2, { schemaVersion: 2 })),
    true
  );
  assert.equal(validateArtifact(artifact('rubric', {
    description: '', totalPoints: 100, scaleLabel: 'puntos'
  })), true);
  assert.equal(validateArtifact(artifact('rubric', {
    instructions: 'Sigue la pauta', observations: '', totalPoints: 100
  }, { schemaVersion: 2 })), true);
  assert.equal(validateArtifact(artifact('rubric_criterion', {
    code: 'C1', description: 'Argumenta', maxPoints: 20, weight: 20, required: true
  }, { parentId: 'rubric_contract' })), true);
  assert.equal(validateArtifact(artifact('rubric_criterion', {
    description: 'Argumenta', maxPoints: 20, required: true, state: 'pending'
  }, { parentId: 'rubric_contract', schemaVersion: 2 })), true);
  assert.equal(validateArtifact(artifact('evidence', {
    summary: 'Resultado', excerpt: '', locator: { page: 1, section: '', timestamp: null },
    confidence: 'reviewed'
  })), true);
  assert.equal(validateArtifact(artifact('report', {
    reportType: 'academic', abstract: '', language: 'es'
  })), true);
  assert.equal(validateArtifact(artifact('report_section', {
    heading: 'Resultados', body: ''
  }, { parentId: 'report_contract' })), true);
});

test('los contratos rechazan tipos futuros, campos arbitrarios y versiones desconocidas', () => {
  assert.throws(() => validateArtifact(artifact('presentation', {})), /no está habilitado/);
  assert.throws(() => validateArtifact(artifact('source', { ...sourceData, arbitrary: true })), /no reconocidos/);
  assert.throws(
    () => validateArtifact(artifact('rubric', {
      description: '', totalPoints: 100, scaleLabel: 'puntos'
    }, { schemaVersion: 3 })),
    /no es compatible/
  );
  assert.throws(() => validateProject(project({ extra: true })), /no reconocidos/);
  assert.throws(() => assertProjectSubject(project(), null), /asignatura no existe/);
});

test('las relaciones solo aceptan semánticas compatibles dentro del proyecto', () => {
  const evidence = artifact('evidence', {
    summary: 'Resultado', excerpt: '', locator: { page: null, section: '', timestamp: null },
    confidence: 'confirmed'
  });
  const criterion = artifact('rubric_criterion', {
    code: '', description: 'Demostrar', maxPoints: null, weight: null, required: true
  });
  const relation = {
    id: 'relation_contract', projectId: 'project_contract', fromId: evidence.id,
    toId: criterion.id, type: 'satisfies', note: '', schemaVersion: 1, createdAt: now
  };
  assert.equal(validateRelation(relation, evidence, criterion), true);
  assert.equal(relationKey(relation), 'project_contract\u001fevidence_contract\u001frubric_criterion_contract\u001fsatisfies');
  assert.throws(() => validateRelation({ ...relation, toId: relation.fromId }, evidence, evidence), /autorrelaciones/);
  assert.throws(() => validateRelation({ ...relation, type: 'cites' }, evidence, criterion), /no permite/);
  assert.throws(() => validateRelation(relation, evidence, { ...criterion, projectId: 'project_other' }), /mismo proyecto/);
});
