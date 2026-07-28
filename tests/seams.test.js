import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calibrationSummary } from '../js/calibration.js';
import {
  createExamAttempt,
  DEFAULT_EXAM_QUESTION_COUNT,
  normalizeExamConfidence
} from '../js/exam.js';
import {
  EVIDENCE_STATE_OPTIONS,
  EVIDENCE_TYPE_OPTIONS,
  evidenceStateLabel,
  evidenceTypeLabel
} from '../js/evidence/evidence-labels.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('el simulacro conserva confianza y duración reales en el intento', () => {
  const answer = {
    card: { id: 'card_1', docId: 'doc_1' },
    correct: false,
    confidence: 5,
    durationMs: 4321
  };
  const attempt = createExamAttempt(answer, {
    id: 'attempt_1',
    createdAt: '2026-07-28T10:00:00.000Z'
  });
  assert.equal(attempt.confidence, 5);
  assert.equal(attempt.durationMs, 4321);
  assert.equal(attempt.rating, 1);
  assert.equal(attempt.mode, 'exam');
  assert.throws(() => normalizeExamConfidence(0), /entre 1 y 5/);
});

test('la sesión exige respuesta y confianza antes de crear el intento', async () => {
  const [session, app] = await Promise.all([
    read('js/sessions.js'),
    read('js/app.js')
  ]);
  assert.match(session, /data-exam-confidence/);
  assert.match(session, /disabled = !selected \|\| confidence === null/);
  assert.match(session, /confidence,[\s\S]*durationMs:/);
  assert.match(app, /createExamAttempt\(item/);
  assert.doesNotMatch(app, /confidence:\s*0/);
});

test('Simulacro alimenta la detección de puntos ciegos de Calibración', () => {
  const summary = calibrationSummary([
    { mode: 'exam', confidence: 5, rating: 1 },
    { mode: 'exam', confidence: 4, rating: 3 },
    { mode: 'study', confidence: 2, rating: 1 }
  ]);
  assert.equal(summary.confident, 2);
  assert.equal(summary.blindSpots, 1);
  assert.equal(summary.rate, 50);
  assert.match(summary.title, /50%/);
});

test('diez preguntas es el valor predeterminado explícito', async () => {
  const html = await read('index.html');
  assert.equal(DEFAULT_EXAM_QUESTION_COUNT, 10);
  assert.match(html, /id="examCount"><option value="10" selected>10<\/option>/);
});

test('las etiquetas de evidencia tienen identificadores estables y una sola autoridad', async () => {
  assert.deepEqual(EVIDENCE_TYPE_OPTIONS.map(item => item.id), [
    'text', 'document', 'photo', 'technical_result',
    'procedure', 'finding', 'calculation', 'table_record'
  ]);
  assert.deepEqual(EVIDENCE_STATE_OPTIONS.map(item => item.id), [
    'collected', 'review', 'approved', 'discarded'
  ]);
  assert.equal(evidenceTypeLabel('photo'), 'Fotografía');
  assert.equal(evidenceStateLabel('approved'), 'Aprobada');
  const html = await read('index.html');
  assert.doesNotMatch(html, /<option value="photo"/);
  assert.doesNotMatch(html, /Fotografía existente|Procedimiento realizado/);
});

test('la guía académica expone el flujo completo con semántica accesible', async () => {
  const html = await read('index.html');
  assert.match(html, /aria-labelledby="academicFlowTitle"/);
  assert.match(html, /Biblioteca[\s\S]*Fuente[\s\S]*Rúbrica y criterio[\s\S]*Evidencia[\s\S]*Informe/);
});

test('producto y datos permanecen mientras el Service Worker avanza', async () => {
  const [ux, worker, migrations, backup] = await Promise.all([
    read('js/ux/ux-controller.js'),
    read('service-worker.js'),
    read('js/academic/academic-migrations.js'),
    read('js/academic/backup-v2.js')
  ]);
  assert.match(ux, /FORJA_VERSION = '2\.0\.0'/);
  assert.match(worker, /RELEASE_VERSION = '2026\.07\.28-8'/);
  assert.match(migrations, /TARGET_DB_VERSION = 3/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 2/);
});
