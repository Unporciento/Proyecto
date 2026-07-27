export const PROJECT_SCHEMA_VERSION = 2;
export const PROJECT_STATUSES = Object.freeze([
  'active', 'submitted', 'graded', 'archived'
]);
export const PROJECT_ICONS = Object.freeze([
  'book', 'wrench', 'flask', 'calculator', 'health', 'code', 'briefcase', 'star'
]);

const V1_KEYS = [
  'id', 'subjectId', 'title', 'description', 'status', 'schemaVersion',
  'createdAt', 'updatedAt', 'submittedAt', 'archivedAt'
];
const V2_KEYS = [
  ...V1_KEYS, 'professor', 'semester', 'startDate', 'dueDate',
  'color', 'icon', 'progress'
];

function fail(message) {
  throw new TypeError(`Proyecto no válido: ${message}`);
}

function exactKeys(value, expected) {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    fail('contiene campos ausentes o no reconocidos.');
  }
}

function text(value, label, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    fail(`${label} es incorrecto.`);
  }
}

function date(value, label, nullable = false) {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    fail(`${label} es incorrecto.`);
  }
}

function validateCommon(project) {
  text(project.id, 'id', 120);
  text(project.subjectId, 'subjectId', 120);
  text(project.title, 'title', 300);
  text(project.description, 'description', 20_000, false);
  if (!PROJECT_STATUSES.includes(project.status)) fail('status no está permitido.');
  date(project.createdAt, 'createdAt');
  date(project.updatedAt, 'updatedAt');
  date(project.submittedAt, 'submittedAt', true);
  date(project.archivedAt, 'archivedAt', true);
}

function validateV2(project) {
  text(project.professor, 'professor', 120, false);
  text(project.semester, 'semester', 60);
  date(project.startDate, 'startDate');
  date(project.dueDate, 'dueDate');
  if (Date.parse(project.startDate) > Date.parse(project.dueDate)) {
    fail('la fecha de entrega debe ser igual o posterior al inicio.');
  }
  if (!/^#[0-9a-f]{6}$/i.test(project.color)) fail('color no está permitido.');
  if (!PROJECT_ICONS.includes(project.icon)) fail('icon no está permitido.');
  if (!Number.isInteger(project.progress) || project.progress < 0 || project.progress > 100) {
    fail('progress debe estar entre 0 y 100.');
  }
}

export function normalizeProjectTitle(value) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

export function validateProject(project) {
  if (!project || Object.getPrototypeOf(project) !== Object.prototype) {
    fail('debe ser un objeto simple.');
  }
  if (project.schemaVersion === 1) exactKeys(project, V1_KEYS);
  else if (project.schemaVersion === PROJECT_SCHEMA_VERSION) exactKeys(project, V2_KEYS);
  else fail('schemaVersion no es compatible.');
  validateCommon(project);
  if (project.schemaVersion === PROJECT_SCHEMA_VERSION) validateV2(project);
  return true;
}

export function makeProjectRecord(input, { id, now = new Date(), existing = null } = {}) {
  const timestamp = new Date(now).toISOString();
  const status = input.status;
  const progress = typeof input.progress === 'number'
    ? input.progress
    : /^\d{1,3}$/.test(input.progress) ? Number(input.progress) : Number.NaN;
  const record = {
    id: existing?.id || id,
    subjectId: input.subjectId,
    title: input.title.trim().replace(/\s+/g, ' '),
    description: input.description.trim(),
    status,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
    submittedAt: ['submitted', 'graded'].includes(status)
      ? existing?.submittedAt || timestamp
      : null,
    archivedAt: status === 'archived' ? existing?.archivedAt || timestamp : null,
    professor: input.professor.trim(),
    semester: input.semester.trim().replace(/\s+/g, ' '),
    startDate: input.startDate,
    dueDate: input.dueDate,
    color: input.color.toLowerCase(),
    icon: input.icon,
    progress
  };
  validateProject(record);
  return record;
}

export function assertProjectSubject(project, subject) {
  validateProject(project);
  if (!subject || subject.id !== project.subjectId) {
    throw new TypeError('Proyecto no válido: la asignatura no existe.');
  }
  return true;
}
