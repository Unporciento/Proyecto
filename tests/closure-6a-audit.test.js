import test from 'node:test';
import assert from 'node:assert/strict';
import { auditConnections } from '../scripts/audit-connections.js';
import { ExamSession, startExamSession } from '../js/sessions.js';

test('los nueve puntos de entrada alcanzan los 77 módulos de producción', () => {
  const audit = auditConnections();
  assert.equal(audit.entries.length, 9);
  assert.equal(audit.moduleCount, 77);
  assert.equal(audit.reachableCount, 77);
  assert.deepEqual(audit.unreachable, []);
});

test('el shell de instalación cubre todos los recursos locales conectados', () => {
  const audit = auditConnections();
  assert.deepEqual(audit.shellMissingScripts, []);
  assert.deepEqual(audit.shellMissingStyles, []);
});

test('ExamSession libera el intervalo al abandonar, reiniciar y cerrar', () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const originalWindow = globalThis.window;
  const active = new Set();
  const listeners = new Set();
  globalThis.setInterval = callback => {
    const token = { callback };
    active.add(token);
    return token;
  };
  globalThis.clearInterval = token => active.delete(token);
  globalThis.window = {
    addEventListener(name, listener) {
      if (name === 'forja:viewchange') listeners.add(listener);
    },
    removeEventListener(name, listener) {
      if (name === 'forja:viewchange') listeners.delete(listener);
    }
  };
  try {
    const session = new ExamSession({}, [], 10, { onFinish() {} });
    session.render = () => {};
    session.start();
    assert.equal(active.size, 1);
    session.start();
    assert.equal(active.size, 1);
    session.answers.push({ id: 'answer_one' });
    for (const listener of listeners) listener({ detail: { view: 'inicio' } });
    assert.equal(active.size, 0);
    assert.deepEqual(session.answers, [{ id: 'answer_one' }]);
    assert.equal(session.timer, null);
    session.dispose();
    assert.equal(active.size, 0);
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
    globalThis.window = originalWindow;
  }
});

test('iniciar y abandonar simulacros repetidamente mantiene cero o un intervalo', () => {
  const originalRender = ExamSession.prototype.render;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const originalWindow = globalThis.window;
  const active = new Set();
  const listeners = new Set();
  ExamSession.prototype.render = () => {};
  globalThis.setInterval = () => {
    const token = {};
    active.add(token);
    return token;
  };
  globalThis.clearInterval = token => active.delete(token);
  globalThis.window = {
    addEventListener: (_name, listener) => listeners.add(listener),
    removeEventListener: (_name, listener) => listeners.delete(listener)
  };
  try {
    for (let index = 0; index < 20; index += 1) {
      startExamSession({}, [], 10, { onFinish() {} });
      assert.equal(active.size, 1);
      for (const listener of [...listeners]) listener({ detail: { view: 'inicio' } });
      assert.equal(active.size, 0);
    }
    console.log('Métrica simulacro FORJA: 20 abandonos, máximo activo=1, activos finales=0');
  } finally {
    ExamSession.prototype.render = originalRender;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
    globalThis.window = originalWindow;
  }
});
