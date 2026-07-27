import {
  REPORT_SCHEMA_VERSION,
  validateArtifact,
  validateArtifactParent
} from './artifact-schemas.js';
import { validateRelationShape } from './relation-model.js';

export const REPORT_STATES = Object.freeze(['draft', 'final']);

function fail(message) {
  throw new TypeError(`Informe no válido: ${message}`);
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function unique(values, label) {
  if (!Array.isArray(values)) fail(`${label} debe ser una lista.`);
  const ids = values.map(clean);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    fail(`${label} contiene relaciones vacías o duplicadas.`);
  }
  return ids;
}

function makeRelation(old, ids, projectId, fromId, toId, type, now) {
  const key = `${type}:${fromId}:${toId}`;
  const relation = {
    id: old.get(key)?.id || ids(key),
    projectId, fromId, toId, type, note: '',
    schemaVersion: 1,
    createdAt: old.get(key)?.createdAt || now
  };
  if (!relation.id) fail('falta un identificador de relación.');
  validateRelationShape(relation);
  return relation;
}

export function makeReportBundle(input, {
  existing = null,
  ids = () => null,
  now = new Date()
} = {}) {
  const timestamp = new Date(now).toISOString();
  const reportId = existing?.report.id || ids('report');
  if (!reportId) fail('falta el identificador del informe.');
  if (!REPORT_STATES.includes(input.state)) fail('el estado no está permitido.');
  const report = {
    id: reportId,
    projectId: input.projectId,
    parentId: null,
    kind: 'report',
    title: clean(input.title).replace(/\s+/g, ' '),
    status: input.state,
    position: 0,
    data: {
      abstract: clean(input.abstract),
      language: clean(input.language) || 'es'
    },
    schemaVersion: REPORT_SCHEMA_VERSION,
    createdAt: existing?.report.createdAt || timestamp,
    updatedAt: timestamp
  };
  validateArtifact(report);

  const previousSections = new Map(
    (existing?.sections || []).map(section => [section.id, section])
  );
  const oldRelations = new Map((existing?.relations || []).map(relation => [
    `${relation.type}:${relation.fromId}:${relation.toId}`, relation
  ]));
  const seen = new Set();
  const sections = input.sections.map((value, position) => {
    const old = value.id ? previousSections.get(value.id) : null;
    const id = old?.id || value.id || ids('report_section');
    if (!id || seen.has(id)) fail('hay secciones sin identificador o duplicadas.');
    seen.add(id);
    const section = {
      id,
      projectId: report.projectId,
      parentId: report.id,
      kind: 'report_section',
      title: clean(value.title).replace(/\s+/g, ' '),
      status: report.status,
      position,
      data: { heading: clean(value.title), body: clean(value.body) },
      schemaVersion: REPORT_SCHEMA_VERSION,
      createdAt: old?.createdAt || timestamp,
      updatedAt: timestamp
    };
    validateArtifact(section);
    validateArtifactParent(section, report);
    return section;
  });
  const relations = [];
  input.sections.forEach((value, index) => {
    unique(value.evidenceIds || [], 'evidenceIds').forEach(toId =>
      relations.push(makeRelation(
        oldRelations, ids, report.projectId, sections[index].id, toId,
        'derived_from', timestamp
      ))
    );
    unique(value.sourceIds || [], 'sourceIds').forEach(toId =>
      relations.push(makeRelation(
        oldRelations, ids, report.projectId, sections[index].id, toId,
        'cites', timestamp
      ))
    );
  });
  return { report, sections, relations };
}
