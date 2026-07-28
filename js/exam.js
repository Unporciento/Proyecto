export const DEFAULT_EXAM_QUESTION_COUNT = 10;
export const EXAM_CONFIDENCE_LEVELS = Object.freeze([1, 2, 3, 4, 5]);

export function normalizeExamConfidence(value) {
  const confidence = Number(value);
  if (!EXAM_CONFIDENCE_LEVELS.includes(confidence)) {
    throw new Error('La confianza del simulacro debe estar entre 1 y 5.');
  }
  return confidence;
}

export function createExamAttempt(answer, { id, createdAt }) {
  if (!answer?.card?.id || !answer.card.docId) {
    throw new Error('La respuesta del simulacro no tiene una pregunta válida.');
  }
  if (!id || !createdAt) {
    throw new Error('El intento del simulacro necesita identidad y fecha.');
  }
  const durationMs = Number(answer.durationMs);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error('La duración del intento no es válida.');
  }
  return {
    id,
    cardId: answer.card.id,
    docId: answer.card.docId,
    createdAt,
    rating: answer.correct ? 3 : 1,
    confidence: normalizeExamConfidence(answer.confidence),
    durationMs,
    mode: 'exam'
  };
}
