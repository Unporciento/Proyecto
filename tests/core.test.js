import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, generateCards, scoreTypedAnswer } from '../js/generator.js';
import { isDue, masteryScore, schedule } from '../js/scheduler.js';
import { buildCalendar, examCountdown } from '../js/planner.js';
import { validateBackup } from '../js/backup.js';
import { isDismissSwipe, resolveView } from '../js/drawer.js';
import { contrastText, normalizeHex, resolveAccent } from '../js/theme.js';
import { isSafeAvatar } from '../js/profile.js';
import { localDayKey, newlyUnlocked, streakStats } from '../js/streak.js';
import { resolveEnergyMode } from '../js/energy.js';

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

test('la navegación solo acepta vistas conocidas y detecta el gesto de cierre', () => {
  assert.equal(resolveView('biblioteca'), 'biblioteca');
  assert.equal(resolveView('biblioteca\"]'), null);
  assert.ok(isDismissSwipe({ startX: 280, startY: 100, endX: 120, endY: 115, durationMs: 300 }));
  assert.ok(!isDismissSwipe({ startX: 120, startY: 100, endX: 280, endY: 110, durationMs: 300 }));
});

test('las paletas rechazan valores arbitrarios y conservan contraste', () => {
  assert.equal(normalizeHex('red'), '#b9ef73');
  assert.equal(resolveAccent({ palette: 'custom', customAccent: '#123abc' }), '#123abc');
  assert.equal(contrastText('#f3c65f'), '#102016');
  assert.equal(contrastText('#123abc'), '#ffffff');
});

test('la foto local solo acepta un data URI JPEG acotado', () => {
  assert.ok(isSafeAvatar('data:image/jpeg;base64,AAAA'));
  assert.ok(!isSafeAvatar('https://example.com/avatar.jpg'));
  assert.ok(!isSafeAvatar('data:image/svg+xml,<svg onload=alert(1)>'));
});

test('restaura un respaldo coherente y bloquea referencias manipuladas', () => {
  const backup = {
    version: 1,
    subjects: [{ id: 'subject_1', name: 'General' }],
    documents: [{ id: 'doc_1', subjectId: 'subject_1', name: 'Guía', text: 'Texto suficiente', createdAt: '2026-07-22T10:00:00.000Z' }],
    cards: [{ id: 'card_1', docId: 'doc_1', question: '¿Qué?', answer: 'Esto', createdAt: '2026-07-22T10:00:00.000Z' }],
    attempts: [{ id: 'attempt_1', cardId: 'card_1', createdAt: '2026-07-22T10:00:00.000Z' }],
    settings: [{ key: 'themeMode', value: 'dark' }]
  };
  assert.equal(validateBackup(backup).cards.length, 1);
  assert.throws(() => validateBackup({ ...backup, cards: [{ id: 'card_1', docId: 'doc_missing' }] }), /sin material/);
  const poisoned = JSON.parse(JSON.stringify(backup).replace('"question"', '"__proto__"'));
  assert.throws(() => validateBackup(poisoned), /clave bloqueada/);
});

test('la racha usa días locales, conserva récord y calcula el próximo premio', () => {
  const attempts = [10, 11, 20, 21, 22].flatMap(day => [1, 2, 3].map(index => ({ createdAt: `2026-07-${day}T18:00:0${index}` })));
  const streak = streakStats(attempts, new Date('2026-07-22T20:00:00'));
  assert.equal(streak.current, 3);
  assert.equal(streak.best, 3);
  assert.equal(streak.next.days, 7);
  assert.equal(streak.unlocked[0].name, 'Arranque');
  assert.equal(localDayKey('2026-07-22T23:30:00'), '2026-07-22');
  assert.equal(streakStats([], new Date('2026-07-22T20:00:00'), 30).best, 30);
});

test('detecta recompensas nuevas sin repetir las anteriores', () => {
  const rewards = newlyUnlocked({ best: 6 }, { best: 7 });
  assert.deepEqual(rewards.map(item => item.days), [7]);
});

test('el modo automático ahorra en móvil o hardware modesto', () => {
  const powerful = { saveData: false, reducedMotion: false, coarsePointer: false, lowBattery: false, hardwareConcurrency: 8, deviceMemory: 8 };
  assert.equal(resolveEnergyMode('auto', powerful), 'standard');
  assert.equal(resolveEnergyMode('auto', { ...powerful, coarsePointer: true }), 'saver');
  assert.equal(resolveEnergyMode('standard', { ...powerful, lowBattery: true }), 'standard');
});
