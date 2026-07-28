const EMOJI = /\p{Extended_Pictographic}/u;
const INFORMAL = /\b(tú|tu|tus|te|contigo|ustedes chicos)\b/i;
const FALSE_RELATION = /\b(me alegra|estoy orgullos[oa]|me preocupa por usted|recordaré|recuerdo que usted)\b/i;
const FORBIDDEN_OUTCOME = /\b(aprobad[ao] como evidencia|su nota será|obtendrá un \d|calificación oficial)\b/i;
const EMPTY_PRAISE = /\b(excelente|muy bien|buen trabajo|perfecto)\b/i;
const HUMILIATION = /\b(tonto|estúpido|inútil|incapaz|ridículo)\b/i;
const THERAPEUTIC = /\b(como su terapeuta|le diagnostico|usted padece)\b/i;

export const TECHNICAL_MESSAGES = Object.freeze({
  provider_unavailable:
    'El servicio de asistencia académica no está disponible. Sus documentos y funciones locales continúan disponibles.',
  offline:
    'El servicio de asistencia académica no está disponible sin conexión. Sus documentos y funciones locales continúan disponibles.',
  policy_blocked:
    'La solicitud no puede procesarse con los permisos y el contexto disponibles.',
  insufficient_context:
    'No hay contexto suficiente para preparar esta consulta.'
});

export function responseRespectsCanon(text) {
  if (typeof text !== 'string' || !text.trim()) return false;
  return !EMOJI.test(text)
    && !INFORMAL.test(text)
    && !FALSE_RELATION.test(text)
    && !FORBIDDEN_OUTCOME.test(text)
    && !EMPTY_PRAISE.test(text)
    && !HUMILIATION.test(text)
    && !THERAPEUTIC.test(text);
}

export function technicalResponse(requestId, status) {
  return {
    schemaVersion: 'buenaventura-response-v1',
    requestId,
    status,
    text: TECHNICAL_MESSAGES[status] || TECHNICAL_MESSAGES.policy_blocked,
    references: []
  };
}
