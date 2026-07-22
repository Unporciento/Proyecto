import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, generateCards, scoreTypedAnswer } from '../js/generator.js';
import { isDue, masteryScore, schedule } from '../js/scheduler.js';
import { buildCalendar, examCountdown } from '../js/planner.js';

const doc = {
  id: 'doc_test', name: 'Guía de prueba',
  text: `La presión hidráulica es la fuerza ejercida por unidad de superficie. El sistema hidráulico incluye una bomba, válvulas, actuadores y un depósito. La válvula de alivio limita la presión máxima para proteger los componentes del circuito. El mantenimiento preventivo reduce fallas inesperadas y permite detectar contaminación antes de que provoque desgaste acelerado.`
};

test('limpia Markdown sin perder el contenido', () => {
  assert.equal(cleanText('## Título\n**Texto** [útil](https://x.cl)'), 'Título\nTexto útil');
});

test('genera preguntas trazables desde el material', () => {
  const cards = generateCards(doc);
  assert.ok(cards.length >= 3);
  assert.ok(cards.every(card => card.docId === doc.id && card.answer.length > 3));
});

test('la comparación orientativa premia ideas clave', () => {
  const card = { answer: 'La bomba convierte energía mecánica en energía hidráulica.', keywords: ['bomba', 'energia', 'mecanica', 'hidraulica'] };
  assert.ok(scoreTypedAnswer('La bomba transforma energía mecánica a hidráulica', card) >= 75);
});

test('un fallo vuelve pronto y un acierto se espacia', () => {
  const base = { id: 'card_1234', ease: 2.5, repetitions: 0, intervalDays: 0, lapses: 0 };
  const failed = schedule(base, 1, 1_000_000);
  const easy = schedule(base, 4, 1_000_000);
  assert.ok(new Date(failed.dueAt) < new Date(easy.dueAt));
  assert.equal(failed.lapses, 1);
  assert.ok(isDue({ ...failed, dueAt: new Date(0).toISOString() }, 1_000_000));
});

test('el dominio crece con intervalos estables', () => {
  assert.ok(masteryScore({ repetitions: 5, intervalDays: 30, lapses: 0 }) > masteryScore({ repetitions: 1, intervalDays: 1, lapses: 0 }));
});

test('genera un calendario válido y con alarma', () => {
  const calendar = buildCalendar({ dailyGoal: 25, studyTime: '19:30' });
  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(calendar, /BEGIN:VALARM/);
  assert.match(calendar, /DTSTART:\d{8}T193000/);
  assert.equal(examCountdown('invalid'), null);
});
