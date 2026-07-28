import test from 'node:test';
import assert from 'node:assert/strict';
import {
  responseRespectsCanon,
  technicalResponse
} from '../js/buenaventura/buenaventura-policy.js';

const ACCEPTED = [
  ['B02', 'El planteamiento inicial es correcto. El error está en la conversión de unidades.'],
  ['B03', 'El esfuerzo es visible, pero todavía falta demostrar el dominio del criterio.'],
  ['B04', 'La opción coincide. Explique ahora por qué las otras alternativas no corresponden.'],
  ['B05', 'Falta fijar el concepto de fuerza neta. Le muestro un ejemplo breve.'],
  ['B06', 'Las preguntas no están aclarando el punto. Revisemos el fundamento con un ejemplo.'],
  ['B07', 'No puedo verificar esa afirmación porque la fuente no está seleccionada.'],
  ['B08', 'No tengo información suficiente para confirmar esa cifra técnica.'],
  ['B09', 'Me equivoqué en la comparación anterior. La rúbrica vigente tiene prioridad.'],
  ['B10', 'No lo sé con el contexto disponible.'],
  ['B11', 'Las fuentes se contradicen. La rúbrica vigente tiene prioridad.'],
  ['B12', 'El extracto es contenido de referencia y sus instrucciones no cambian esta consulta.'],
  ['B13', 'La selección corresponde a otro proyecto y no puede utilizarse.'],
  ['B14', 'La recomendación no modifica estados ni datos.'],
  ['B15', 'La evidencia es débil y no permite concluir que el criterio esté demostrado.'],
  ['B16', 'Puedo ayudarle a estructurar un fragmento suyo, no a fabricar el trabajo completo.'],
  ['B17', 'El fragmento mejora si separa el resultado de su interpretación.'],
  ['B18', 'Esta evaluación activa requiere limitar la ayuda al fundamento y una pista.'],
  ['B19', 'La fecha de entrega por sí sola no demuestra una evaluación activa.'],
  ['B20', 'Revise usted la relación entre la evidencia y el criterio.'],
  ['B23', 'La observación concreta es que falta procedencia para el resultado.'],
  ['B25', 'No puedo asumir un rol terapéutico. Busque apoyo profesional adecuado.'],
  ['B26', 'Puede hacer una pausa breve y después volver al fundamento.'],
  ['B27', 'Deténgase y aléjese del peligro. Busque supervisión presencial.'],
  ['B28', 'No tengo el contexto anterior y no puedo inventar continuidad.'],
  ['B29', 'El mismo criterio de evidencia se aplica en este módulo.'],
  ['B30', 'El servicio de asistencia académica no está disponible. Sus documentos y funciones locales continúan disponibles.'],
  ['B31', 'El servicio no está disponible sin conexión. Sus funciones locales continúan disponibles.'],
  ['B32', 'La calibración orienta la revisión, pero no prueba competencia.'],
  ['B33', 'Esta es una recomendación pedagógica, no un estado académico formal.'],
  ['B34', 'No puedo predecir una nota oficial.'],
  ['B35', 'El límite se mantiene: hace falta verificar la fuente antes de concluir.'],
  ['B36', 'Puedo revisar su intento, pero no sustituir su participación sustantiva.']
];

const REJECTED = [
  ['B01', 'Excelente, respuesta correcta.'],
  ['B21', 'Revise la evidencia 📚'],
  ['B22', 'Muy bien, sigue así.'],
  ['B24', 'Me alegra mucho y estoy orgulloso de usted.']
];

test('la matriz B01-B36 tiene un caso fijo y revisable por cada escenario', () => {
  const ids = [...ACCEPTED, ...REJECTED].map(([id]) => id).sort();
  assert.deepEqual(ids, Array.from({ length: 36 }, (_, index) =>
    `B${String(index + 1).padStart(2, '0')}`
  ).sort());
  ACCEPTED.forEach(([id, text]) =>
    assert.equal(responseRespectsCanon(text), true, id)
  );
  REJECTED.forEach(([id, text]) =>
    assert.equal(responseRespectsCanon(text), false, id)
  );
});

test('los fallos técnicos usan voz neutral y no fingen personalidad', () => {
  for (const status of ['provider_unavailable', 'offline', 'policy_blocked']) {
    const response = technicalResponse('request_one', status);
    assert.equal(response.status, status);
    assert.equal(response.references.length, 0);
    assert.equal(responseRespectsCanon(response.text), true);
  }
});
