const LIMITS = Object.freeze({ subjects: 100, documents: 500, cards: 30_000, attempts: 100_000, settings: 100 });
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SETTING_KEYS = new Set(['examDate', 'dailyGoal', 'studyTime', 'sound', 'profileName', 'avatar', 'themeMode', 'palette', 'customAccent', 'energyMode', 'bestStreak']);

function fail(message) {
  throw new Error(`Respaldo no válido: ${message}`);
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function inspect(value, depth = 0) {
  if (depth > 12) fail('la estructura es demasiado profunda.');
  if (typeof value === 'string' && value.length > 2_000_000) fail('contiene un texto demasiado grande.');
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (BLOCKED_KEYS.has(key)) fail('contiene una clave bloqueada.');
    inspect(value[key], depth + 1);
  }
}

function validId(value) {
  return typeof value === 'string' && /^[a-z0-9_-]{3,120}$/i.test(value);
}

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validateRows(name, rows) {
  if (!Array.isArray(rows)) fail(`falta la colección ${name}.`);
  if (rows.length > LIMITS[name]) fail(`${name} supera el límite permitido.`);
  rows.forEach(row => {
    if (!plainObject(row)) fail(`${name} contiene un registro incorrecto.`);
    inspect(row);
    if (name === 'settings') {
      if (!validId(row.key) || !SETTING_KEYS.has(row.key)) fail('hay un ajuste no reconocido.');
    } else if (!validId(row.id)) fail(`${name} contiene un identificador incorrecto.`);
  });
}

export function validateBackup(raw) {
  if (!plainObject(raw) || raw.version !== 1) fail('la versión no es compatible.');
  for (const name of Object.keys(LIMITS)) validateRows(name, raw[name]);

  const subjects = new Set(raw.subjects.map(item => item.id));
  const documents = new Set(raw.documents.map(item => item.id));
  const cards = new Set(raw.cards.map(item => item.id));
  const attempts = new Set(raw.attempts.map(item => item.id));
  const settingKeys = new Set(raw.settings.map(item => item.key));
  if (subjects.size !== raw.subjects.length || documents.size !== raw.documents.length || cards.size !== raw.cards.length || attempts.size !== raw.attempts.length || settingKeys.size !== raw.settings.length) fail('hay identificadores duplicados.');

  raw.subjects.forEach(item => {
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 60) fail('hay una materia incompleta.');
  });

  let textTotal = 0;
  raw.documents.forEach(item => {
    if (!subjects.has(item.subjectId) || typeof item.name !== 'string' || item.name.length > 255 || typeof item.text !== 'string' || !validDate(item.createdAt)) fail('hay un material incompleto.');
    textTotal += item.text.length;
  });
  if (textTotal > 20_000_000) fail('el texto total supera el límite permitido.');
  raw.cards.forEach(item => {
    if (!documents.has(item.docId)) fail('hay una pregunta sin material asociado.');
    if (typeof item.question !== 'string' || typeof item.answer !== 'string' || item.question.length > 5_000 || item.answer.length > 20_000 || !validDate(item.createdAt)) fail('hay una pregunta incompleta.');
  });
  raw.attempts.forEach(item => {
    if (!cards.has(item.cardId)) fail('hay una respuesta sin pregunta asociada.');
    if (!validDate(item.createdAt)) fail('hay una respuesta incompleta.');
  });

  return typeof structuredClone === 'function' ? structuredClone(raw) : JSON.parse(JSON.stringify(raw));
}
