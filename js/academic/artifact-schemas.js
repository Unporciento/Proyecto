export const ARTIFACT_SCHEMA_VERSION = 1;
export const SOURCE_SCHEMA_VERSION = 2;

export const ARTIFACT_KINDS = Object.freeze([
  'source',
  'document_ref',
  'rubric',
  'rubric_criterion',
  'evidence',
  'report',
  'report_section'
]);

const STATUSES = new Set(['draft', 'ready', 'final', 'archived']);
const SOURCE_TYPES = new Set(['book', 'article', 'website', 'manual', 'standard', 'other']);
const SOURCE_TYPES_V2 = new Set([
  'pdf', 'word', 'image', 'website', 'book', 'article', 'note', 'video'
]);
const DOCUMENT_ROLES = new Set(['source_file', 'instruction_file', 'evidence_file', 'working_file']);
const CONFIDENCE = new Set(['unverified', 'reviewed', 'confirmed']);

function fail(message) {
  throw new TypeError(`Artefacto no válido: ${message}`);
}

function plain(value) {
  return value !== null && typeof value === 'object' &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactObject(value, keys, label) {
  if (!plain(value)) fail(`${label} debe ser un objeto simple.`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${label} contiene campos ausentes o no reconocidos.`);
  }
}

function text(value, label, max, { empty = true } = {}) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) {
    fail(`${label} es incorrecto.`);
  }
}

function nullableNumber(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value !== null && (!Number.isFinite(value) || value < min || value > max)) {
    fail(`${label} es incorrecto.`);
  }
}

function nullableDate(value, label) {
  if (value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) {
    fail(`${label} es incorrecto.`);
  }
}

function stringList(value, label) {
  if (!Array.isArray(value) || value.length > 50) fail(`${label} es incorrecto.`);
  value.forEach(item => text(item, label, 200, { empty: false }));
}

function sourceV2(data) {
  exactObject(
    data,
    ['sourceType', 'description', 'author', 'date', 'url', 'notes'],
    'source.data'
  );
  if (!SOURCE_TYPES_V2.has(data.sourceType)) fail('sourceType no está permitido.');
  text(data.description, 'description', 20_000);
  text(data.author, 'author', 300);
  nullableDate(data.date, 'date');
  text(data.url, 'url', 2_000);
  text(data.notes, 'notes', 20_000);
  if (['website', 'video'].includes(data.sourceType) && !data.url) {
    fail('url es obligatoria para este tipo.');
  }
  if (data.url) {
    let parsed;
    try { parsed = new URL(data.url); } catch { fail('url es incorrecta.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) fail('url usa un protocolo no permitido.');
  }
}

const DATA_VALIDATORS = {
  source(data) {
    exactObject(data, ['sourceType', 'authors', 'publicationTitle', 'publisher', 'year', 'url', 'accessedAt', 'notes'], 'source.data');
    if (!SOURCE_TYPES.has(data.sourceType)) fail('sourceType no está permitido.');
    stringList(data.authors, 'authors');
    text(data.publicationTitle, 'publicationTitle', 500);
    text(data.publisher, 'publisher', 300);
    nullableNumber(data.year, 'year', { min: 0, max: 9999 });
    text(data.url, 'url', 2_000);
    nullableDate(data.accessedAt, 'accessedAt');
    text(data.notes, 'notes', 20_000);
  },
  document_ref(data) {
    exactObject(data, ['documentId', 'role'], 'document_ref.data');
    text(data.documentId, 'documentId', 120, { empty: false });
    if (!DOCUMENT_ROLES.has(data.role)) fail('role no está permitido.');
  },
  rubric(data) {
    exactObject(data, ['description', 'totalPoints', 'scaleLabel'], 'rubric.data');
    text(data.description, 'description', 20_000);
    nullableNumber(data.totalPoints, 'totalPoints', { max: 1_000_000 });
    text(data.scaleLabel, 'scaleLabel', 100);
  },
  rubric_criterion(data) {
    exactObject(data, ['code', 'description', 'maxPoints', 'weight', 'required'], 'rubric_criterion.data');
    text(data.code, 'code', 80);
    text(data.description, 'description', 20_000, { empty: false });
    nullableNumber(data.maxPoints, 'maxPoints', { max: 1_000_000 });
    nullableNumber(data.weight, 'weight', { max: 100 });
    if (typeof data.required !== 'boolean') fail('required es incorrecto.');
  },
  evidence(data) {
    exactObject(data, ['summary', 'excerpt', 'locator', 'confidence'], 'evidence.data');
    text(data.summary, 'summary', 20_000, { empty: false });
    text(data.excerpt, 'excerpt', 100_000);
    exactObject(data.locator, ['page', 'section', 'timestamp'], 'locator');
    nullableNumber(data.locator.page, 'page', { min: 1, max: 1_000_000 });
    text(data.locator.section, 'section', 500);
    nullableNumber(data.locator.timestamp, 'timestamp', { max: 100_000_000 });
    if (!CONFIDENCE.has(data.confidence)) fail('confidence no está permitido.');
  },
  report(data) {
    exactObject(data, ['reportType', 'abstract', 'language'], 'report.data');
    if (data.reportType !== 'academic') fail('reportType no está permitido.');
    text(data.abstract, 'abstract', 50_000);
    text(data.language, 'language', 20, { empty: false });
  },
  report_section(data) {
    exactObject(data, ['heading', 'body'], 'report_section.data');
    text(data.heading, 'heading', 500, { empty: false });
    text(data.body, 'body', 500_000);
  }
};

export function validateArtifactData(kind, data, schemaVersion = ARTIFACT_SCHEMA_VERSION) {
  if (kind === 'source' && schemaVersion === SOURCE_SCHEMA_VERSION) {
    sourceV2(data);
    return true;
  }
  const validator = DATA_VALIDATORS[kind];
  if (!validator) fail(`el tipo ${String(kind)} no está habilitado.`);
  validator(data);
  return true;
}

export function validateArtifact(artifact) {
  exactObject(artifact, [
    'id', 'projectId', 'parentId', 'kind', 'title', 'status', 'position',
    'data', 'schemaVersion', 'createdAt', 'updatedAt'
  ], 'artefacto');
  text(artifact.id, 'id', 120, { empty: false });
  text(artifact.projectId, 'projectId', 120, { empty: false });
  if (artifact.parentId !== null) text(artifact.parentId, 'parentId', 120, { empty: false });
  if (!ARTIFACT_KINDS.includes(artifact.kind)) fail('kind no está habilitado.');
  text(artifact.title, 'title', 500, { empty: false });
  if (!STATUSES.has(artifact.status)) fail('status no está permitido.');
  if (!Number.isSafeInteger(artifact.position) || artifact.position < 0) fail('position es incorrecto.');
  const compatibleVersion = artifact.schemaVersion === ARTIFACT_SCHEMA_VERSION
    || (artifact.kind === 'source' && artifact.schemaVersion === SOURCE_SCHEMA_VERSION);
  if (!compatibleVersion) fail('schemaVersion no es compatible.');
  nullableDate(artifact.createdAt, 'createdAt');
  nullableDate(artifact.updatedAt, 'updatedAt');
  if (artifact.createdAt === null || artifact.updatedAt === null) fail('las fechas son obligatorias.');
  validateArtifactData(artifact.kind, artifact.data, artifact.schemaVersion);
  return true;
}

export function validateArtifactParent(artifact, parent) {
  const expected = {
    rubric_criterion: 'rubric',
    report_section: 'report'
  }[artifact.kind];
  if (expected) {
    if (!parent || parent.kind !== expected) fail(`${artifact.kind} debe pertenecer a ${expected}.`);
    if (parent.projectId !== artifact.projectId) fail('padre e hijo deben pertenecer al mismo proyecto.');
  } else if (artifact.parentId !== null) {
    fail(`${artifact.kind} no admite padre.`);
  }
  return true;
}
