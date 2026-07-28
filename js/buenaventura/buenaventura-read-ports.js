import { openForjaDatabase } from '../db.js';

const MODULE_KINDS = Object.freeze({
  rubric: new Set(['rubric', 'rubric_criterion']),
  evidence: new Set(['evidence']),
  report: new Set(['report', 'report_section'])
});

function fail(message) {
  throw new TypeError(`Contexto Buenaventura no válido: ${message}`);
}

function result(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function clean(value) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function excerptFor(artifact) {
  const data = artifact.data || {};
  if (artifact.kind === 'rubric') {
    return [data.instructions || data.description, data.observations].filter(Boolean).join('\n');
  }
  if (artifact.kind === 'rubric_criterion') {
    return [
      data.description,
      Number.isFinite(data.maxPoints) ? `Puntaje máximo: ${data.maxPoints}.` : '',
      data.state ? `Estado registrado: ${data.state}.` : ''
    ].filter(Boolean).join('\n');
  }
  if (artifact.kind === 'evidence') {
    return [
      data.description || data.summary,
      data.observation || data.excerpt,
      data.state ? `Estado registrado: ${data.state}.` : ''
    ].filter(Boolean).join('\n');
  }
  if (artifact.kind === 'report') return data.abstract || '';
  if (artifact.kind === 'report_section') return data.body || '';
  return '';
}

function option(module, item, projectId, preview) {
  return {
    module,
    kind: module === 'library' ? 'document' : item.kind,
    id: item.id,
    projectId,
    title: clean(item.name || item.title),
    preview: clean(preview).slice(0, 180)
  };
}

function fragment(selection, item, projectId) {
  const module = selection.module;
  const isDocument = module === 'library';
  const raw = isDocument ? item.text : excerptFor(item);
  const title = clean(item.name || item.title);
  return {
    schemaVersion: 'buenaventura-fragment-v1',
    module,
    kind: isDocument ? 'document' : item.kind,
    id: item.id,
    projectId,
    title,
    excerpt: clean(raw).slice(0, 2_000),
    provenance: {
      sourceType: isDocument ? 'library_document' : 'academic_artifact',
      sourceId: item.id,
      label: `${module}: ${title}`
    },
    untrusted: true
  };
}

function validateSelections(selections) {
  if (!Array.isArray(selections) || selections.length < 1 || selections.length > 4) {
    fail('seleccione entre uno y cuatro fragmentos.');
  }
  const keys = selections.map(item => `${item.module}:${item.id}`);
  if (new Set(keys).size !== keys.length) fail('la selección contiene duplicados.');
  selections.forEach(item => {
    if (!item || typeof item.id !== 'string'
      || !['library', 'rubric', 'evidence', 'report'].includes(item.module)) {
      fail('la selección contiene un elemento desconocido.');
    }
  });
}

export class BuenaventuraReadPorts {
  constructor(databaseProvider = openForjaDatabase) {
    this.databaseProvider = databaseProvider;
  }

  async list(projectId) {
    const db = await this.databaseProvider();
    const tx = db.transaction(['documents', 'academicProjects', 'projectArtifacts'], 'readonly');
    const [project, documents, artifacts] = await Promise.all([
      result(tx.objectStore('academicProjects').get(projectId)),
      result(tx.objectStore('documents').getAll()),
      result(tx.objectStore('projectArtifacts').index('projectId').getAll(projectId))
    ]);
    if (!project) fail('el proyecto no existe.');
    const options = documents
      .filter(item => item.subjectId === project.subjectId)
      .map(item => option('library', item, projectId, item.text));
    for (const [module, kinds] of Object.entries(MODULE_KINDS)) {
      artifacts.filter(item => kinds.has(item.kind))
        .forEach(item => options.push(option(module, item, projectId, excerptFor(item))));
    }
    return options;
  }

  async fragments(projectId, selections) {
    validateSelections(selections);
    const db = await this.databaseProvider();
    const tx = db.transaction(['documents', 'academicProjects', 'projectArtifacts'], 'readonly');
    const project = await result(tx.objectStore('academicProjects').get(projectId));
    if (!project) fail('el proyecto no existe.');
    const fragments = [];
    for (const selection of selections) {
      const storeName = selection.module === 'library' ? 'documents' : 'projectArtifacts';
      const item = await result(tx.objectStore(storeName).get(selection.id));
      if (!item) fail('un elemento seleccionado ya no existe.');
      if (selection.module === 'library') {
        if (item.subjectId !== project.subjectId) fail('el documento pertenece a otro proyecto.');
      } else {
        const kinds = MODULE_KINDS[selection.module];
        if (item.projectId !== projectId || !kinds.has(item.kind)) {
          fail('un artefacto pertenece a otro proyecto o módulo.');
        }
      }
      const value = fragment(selection, item, projectId);
      if (!value.excerpt) fail('un elemento seleccionado no contiene texto utilizable.');
      fragments.push(value);
    }
    return fragments;
  }
}
