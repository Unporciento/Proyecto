import {
  PRESENTATION_SCHEMA_VERSION,
  validateArtifact,
  validateArtifactParent
} from './artifact-schemas.js';
import { validateRelationShape } from './relation-model.js';

export const SLIDE_STATES = Object.freeze(['draft', 'ready', 'final']);

function fail(message) {
  throw new TypeError(`Presentación no válida: ${message}`);
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

function relation(old, ids, projectId, fromId, toId, type, now) {
  const key = `${type}:${fromId}:${toId}`;
  const value = {
    id: old.get(key)?.id || ids(key),
    projectId, fromId, toId, type, note: '',
    schemaVersion: 1,
    createdAt: old.get(key)?.createdAt || now
  };
  if (!value.id) fail('falta un identificador de relación.');
  validateRelationShape(value);
  return value;
}

export function makePresentationBundle(input, {
  existing = null,
  ids = () => null,
  now = new Date()
} = {}) {
  const timestamp = new Date(now).toISOString();
  const presentationId = existing?.presentation.id || ids('presentation');
  if (!presentationId) fail('falta el identificador.');
  const presentation = {
    id: presentationId,
    projectId: input.projectId,
    parentId: null,
    kind: 'presentation',
    title: clean(input.title).replace(/\s+/g, ' '),
    status: input.state,
    position: 0,
    data: {
      objective: clean(input.objective),
      audience: clean(input.audience),
      packageVersion: 1
    },
    schemaVersion: PRESENTATION_SCHEMA_VERSION,
    createdAt: existing?.presentation.createdAt || timestamp,
    updatedAt: timestamp
  };
  if (!SLIDE_STATES.includes(input.state)) fail('el estado no está permitido.');
  validateArtifact(presentation);
  const previous = new Map((existing?.slides || []).map(item => [item.id, item]));
  const oldRelations = new Map((existing?.relations || []).map(item => [
    `${item.type}:${item.fromId}:${item.toId}`, item
  ]));
  const seen = new Set();
  const slides = input.slides.map((value, position) => {
    const old = value.id ? previous.get(value.id) : null;
    const id = old?.id || value.id || ids('presentation_slide');
    if (!id || seen.has(id)) fail('hay diapositivas sin identificador o duplicadas.');
    seen.add(id);
    if (!SLIDE_STATES.includes(value.state)) fail('el estado de diapositiva no está permitido.');
    const slide = {
      id,
      projectId: presentation.projectId,
      parentId: presentation.id,
      kind: 'presentation_slide',
      title: clean(value.title).replace(/\s+/g, ' '),
      status: value.state,
      position,
      data: {
        heading: clean(value.title),
        content: clean(value.content),
        speakerNotes: clean(value.speakerNotes)
      },
      schemaVersion: PRESENTATION_SCHEMA_VERSION,
      createdAt: old?.createdAt || timestamp,
      updatedAt: timestamp
    };
    validateArtifact(slide);
    validateArtifactParent(slide, presentation);
    return slide;
  });
  const relations = [];
  input.slides.forEach((value, index) => {
    const add = (values, type) => unique(values || [], type).forEach(toId =>
      relations.push(relation(
        oldRelations, ids, presentation.projectId, slides[index].id, toId, type, timestamp
      ))
    );
    add(value.sectionIds, 'derived_from');
    add(value.evidenceIds, 'derived_from');
    add(value.sourceIds, 'cites');
  });
  return { presentation, slides, relations };
}

export function buildNexusPackage(project, details) {
  if (!project || !details) fail('faltan proyecto o presentación.');
  const bySlide = slideId => details.relations.filter(item => item.fromId === slideId);
  return {
    format: 'forja-nexus-package',
    version: 1,
    exportedAt: new Date().toISOString(),
    project: { id: project.id, title: project.title, subjectId: project.subjectId },
    presentation: {
      id: details.presentation.id,
      title: details.presentation.title,
      objective: details.presentation.data.objective,
      audience: details.presentation.data.audience,
      state: details.presentation.status
    },
    slides: details.slides.map(slide => ({
      id: slide.id,
      position: slide.position,
      title: slide.title,
      content: slide.data.content,
      speakerNotes: slide.data.speakerNotes,
      state: slide.status,
      links: bySlide(slide.id).map(item => ({
        type: item.type,
        artifactId: item.toId
      }))
    }))
  };
}
