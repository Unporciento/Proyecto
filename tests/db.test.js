import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as db from '../js/db.js';

test('IndexedDB conserva operaciones relacionadas y restaura atómicamente', async () => {
  await db.clearAll();
  const subject = { id: 'subject_db', name: 'Prueba', createdAt: new Date().toISOString() };
  const document = { id: 'doc_db', subjectId: subject.id, name: 'Guía', text: 'Texto', createdAt: new Date().toISOString() };
  const card = { id: 'card_db', docId: document.id, question: 'Pregunta', answer: 'Respuesta', createdAt: new Date().toISOString() };
  const attempt = { id: 'attempt_db', cardId: card.id, docId: document.id, createdAt: new Date().toISOString(), rating: 3 };

  await db.put('subjects', subject);
  await db.putMaterial(document, [card]);
  await db.putProgress([{ ...card, repetitions: 1 }], [attempt]);
  const exported = await db.exportData();
  assert.equal(exported.version, 2);
  assert.deepEqual(exported.academicProjects, []);
  assert.equal(exported.documents.length, 1);
  assert.equal(exported.cards[0].repetitions, 1);
  assert.equal(exported.attempts.length, 1);

  const replacement = {
    version: 1,
    subjects: [{ id: 'subject_new', name: 'Nueva' }],
    documents: [], cards: [], attempts: [],
    settings: [{ key: 'themeMode', value: 'dark' }]
  };
  await db.replaceAll(replacement);
  assert.deepEqual((await db.all('subjects')).map(item => item.id), ['subject_new']);
  assert.equal((await db.getSettings()).themeMode, 'dark');
  assert.equal((await db.all('documents')).length, 0);
});

test('una restauración que aborta no deja colecciones a medio reemplazar', async () => {
  await db.clearAll();
  await db.put('subjects', { id: 'subject_safe', name: 'Conservar' });
  const invalid = {
    subjects: [{ id: 'subject_bad', name: 'No conservar' }],
    documents: [{ id: 'doc_bad', impossible: () => {} }],
    cards: [], attempts: [], settings: []
  };
  await assert.rejects(() => db.replaceAll(invalid));
  assert.deepEqual((await db.all('subjects')).map(item => item.id), ['subject_safe']);
  assert.equal((await db.all('documents')).length, 0);
});
