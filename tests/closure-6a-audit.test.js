import test from 'node:test';
import assert from 'node:assert/strict';
import { auditConnections } from '../scripts/audit-connections.js';
import { ExamSession } from '../js/sessions.js';

test('los nueve puntos de entrada alcanzan los 77 módulos de producción', () => {
  const audit = auditConnections();
  assert.equal(audit.entries.length, 9);
  assert.equal(audit.moduleCount, 77);
  assert.equal(audit.reachableCount, 77);
  assert.deepEqual(audit.unreachable, []);
});

test('reproduce los recursos conectados que no forman parte del shell de instalación', () => {
  const audit = auditConnections();
  assert.equal(audit.shellMissingScripts.length, 29);
  assert.deepEqual(audit.shellMissingStyles, [
    'css/evidence.css',
    'css/presentations.css',
    'css/projects.css',
    'css/reports.css',
    'css/rubrics.css',
    'css/sources.css'
  ]);
  assert.ok(audit.shellMissingScripts.includes('js/projects/projects-controller.js'));
  assert.ok(audit.shellMissingScripts.includes('js/reports/reports-controller.js'));
  assert.ok(audit.shellMissingScripts.includes('js/academic/source-repository.js'));
});

test('reproduce el intervalo de examen que sigue activo al abandonar la vista', () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const active = new Set();
  globalThis.setInterval = callback => {
    const token = { callback };
    active.add(token);
    return token;
  };
  globalThis.clearInterval = token => active.delete(token);
  try {
    const session = new ExamSession({}, [], 10, { onFinish() {} });
    session.render = () => {};
    session.start();
    assert.equal(active.size, 1);
    // showView() no conserva la instancia ni ofrece un cierre de ciclo de vida.
    assert.equal(typeof session.dispose, 'undefined');
    assert.equal(active.size, 1);
    globalThis.clearInterval(session.timer);
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});
