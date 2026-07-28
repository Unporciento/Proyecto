export const TASKS = Object.freeze(['explain', 'review', 'compare', 'suggest', 'question']);
export const MODULES = Object.freeze(['library', 'rubric', 'evidence', 'report']);
export const STATUSES = Object.freeze([
  'ok', 'insufficient_context', 'cannot_verify', 'ambiguous_source',
  'requires_supervision', 'policy_blocked', 'provider_unavailable', 'offline'
]);
export const PERMISSIONS = Object.freeze(['OBSERVE', 'RECOMMEND']);
export const MAX_FRAGMENTS = 4;
export const MAX_FRAGMENT_CHARS = 2_000;
export const MAX_TOTAL_CHARS = 8_000;

function fail(message) {
  throw new TypeError(`Contrato Buenaventura no válido: ${message}`);
}

function plain(value) {
  return value !== null && typeof value === 'object'
    && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exact(value, keys, label) {
  if (!plain(value)) fail(`${label} debe ser un objeto simple.`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) {
    fail(`${label} contiene campos ausentes o desconocidos.`);
  }
}

function text(value, label, max, { empty = false } = {}) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) {
    fail(`${label} es incorrecto.`);
  }
}

function stringList(value, label, max = MAX_FRAGMENTS) {
  if (!Array.isArray(value) || value.length > max) fail(`${label} es incorrecto.`);
  value.forEach(item => text(item, label, 120));
  if (new Set(value).size !== value.length) fail(`${label} contiene duplicados.`);
}

export function validateFragment(fragment) {
  exact(fragment, [
    'schemaVersion', 'module', 'kind', 'id', 'projectId', 'title',
    'excerpt', 'provenance', 'untrusted'
  ], 'fragment');
  if (fragment.schemaVersion !== 'buenaventura-fragment-v1') {
    fail('schemaVersion de fragmento no es compatible.');
  }
  if (!MODULES.includes(fragment.module)) fail('module de fragmento no está permitido.');
  text(fragment.kind, 'kind', 80);
  text(fragment.id, 'id', 120);
  text(fragment.projectId, 'projectId', 120);
  text(fragment.title, 'title', 500);
  text(fragment.excerpt, 'excerpt', MAX_FRAGMENT_CHARS);
  if (fragment.untrusted !== true) fail('el fragmento debe marcarse como no confiable.');
  exact(fragment.provenance, ['sourceType', 'sourceId', 'label'], 'provenance');
  text(fragment.provenance.sourceType, 'provenance.sourceType', 80);
  text(fragment.provenance.sourceId, 'provenance.sourceId', 120);
  text(fragment.provenance.label, 'provenance.label', 500);
  return true;
}

export function validateRequest(request) {
  exact(request, [
    'schemaVersion', 'requestId', 'task', 'permissions', 'scope',
    'fragments', 'constraints', 'consent'
  ], 'request');
  if (request.schemaVersion !== 'buenaventura-request-v1') {
    fail('schemaVersion de solicitud no es compatible.');
  }
  text(request.requestId, 'requestId', 120);
  if (!TASKS.includes(request.task)) fail('task no está permitida.');
  if (JSON.stringify(request.permissions) !== JSON.stringify(PERMISSIONS)) {
    fail('permissions debe ser exactamente OBSERVE y RECOMMEND.');
  }
  exact(request.scope, ['projectId', 'selectionIds'], 'scope');
  text(request.scope.projectId, 'scope.projectId', 120);
  stringList(request.scope.selectionIds, 'scope.selectionIds');
  if (!Array.isArray(request.fragments)
    || request.fragments.length < 1 || request.fragments.length > MAX_FRAGMENTS) {
    fail('fragments debe contener entre uno y cuatro elementos.');
  }
  request.fragments.forEach(validateFragment);
  if (request.fragments.some(item => item.projectId !== request.scope.projectId)) {
    fail('todos los fragmentos deben pertenecer al proyecto solicitado.');
  }
  if (new Set(request.fragments.map(item => item.id)).size !== request.fragments.length) {
    fail('fragments contiene identificadores duplicados.');
  }
  if (request.scope.selectionIds.length !== request.fragments.length
    || request.fragments.some(item =>
      !request.scope.selectionIds.includes(`${item.module}:${item.id}`)
    )) {
    fail('selectionIds y fragments no coinciden.');
  }
  const total = request.fragments.reduce((sum, item) => sum + item.excerpt.length, 0);
  if (total > MAX_TOTAL_CHARS) fail('el presupuesto total de contexto fue excedido.');
  exact(request.constraints, ['activeEvaluation', 'offline'], 'constraints');
  if (typeof request.constraints.activeEvaluation !== 'boolean'
    || typeof request.constraints.offline !== 'boolean') {
    fail('constraints contiene valores incorrectos.');
  }
  exact(request.consent, ['externalProvider'], 'consent');
  if (typeof request.consent.externalProvider !== 'boolean') {
    fail('consent.externalProvider es incorrecto.');
  }
  return true;
}

export function validateResponse(response) {
  exact(response, ['schemaVersion', 'requestId', 'status', 'text', 'references'], 'response');
  if (response.schemaVersion !== 'buenaventura-response-v1') {
    fail('schemaVersion de respuesta no es compatible.');
  }
  text(response.requestId, 'response.requestId', 120);
  if (!STATUSES.includes(response.status)) fail('status no está permitido.');
  text(response.text, 'response.text', 12_000);
  if (!Array.isArray(response.references) || response.references.length > MAX_FRAGMENTS) {
    fail('references es incorrecto.');
  }
  response.references.forEach(reference => {
    exact(reference, ['fragmentId', 'module', 'id'], 'reference');
    text(reference.fragmentId, 'reference.fragmentId', 120);
    if (!MODULES.includes(reference.module)) fail('reference.module no está permitido.');
    text(reference.id, 'reference.id', 120);
  });
  return true;
}
