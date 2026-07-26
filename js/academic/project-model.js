export const PROJECT_SCHEMA_VERSION = 1;
export const PROJECT_STATUSES = Object.freeze(['active', 'submitted', 'graded', 'archived']);

function fail(message) {
  throw new TypeError(`Proyecto no válido: ${message}`);
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

export function validateProject(project) {
  if (!project || Object.getPrototypeOf(project) !== Object.prototype) fail('debe ser un objeto simple.');
  const keys = [
    'id', 'subjectId', 'title', 'description', 'status', 'schemaVersion',
    'createdAt', 'updatedAt', 'submittedAt', 'archivedAt'
  ].sort();
  const actual = Object.keys(project).sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    fail('contiene campos ausentes o no reconocidos.');
  }
  text(project.id, 'id', 120);
  text(project.subjectId, 'subjectId', 120);
  text(project.title, 'title', 300);
  text(project.description, 'description', 20_000, false);
  if (!PROJECT_STATUSES.includes(project.status)) fail('status no está permitido.');
  if (project.schemaVersion !== PROJECT_SCHEMA_VERSION) fail('schemaVersion no es compatible.');
  date(project.createdAt, 'createdAt');
  date(project.updatedAt, 'updatedAt');
  date(project.submittedAt, 'submittedAt', true);
  date(project.archivedAt, 'archivedAt', true);
  return true;
}

export function assertProjectSubject(project, subject) {
  validateProject(project);
  if (!subject || subject.id !== project.subjectId) {
    throw new TypeError('Proyecto no válido: la asignatura no existe.');
  }
  return true;
}

