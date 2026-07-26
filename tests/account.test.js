import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreVault } from '../js/account-restore.js';
import { MAX_BACKUP_BYTES, MAX_VAULT_BYTES } from '../js/config.js';
import { accountIdentity, accountSecret, encryptVault, generateAccountCode } from '../js/vault.js';

const backup = {
  version: 1,
  subjects: [{ id: 'subject_1', name: 'General' }],
  documents: [{
    id: 'doc_1', subjectId: 'subject_1', name: 'Guía', text: 'Contenido verificable',
    createdAt: '2026-07-26T10:00:00.000Z'
  }],
  cards: [{
    id: 'card_1', docId: 'doc_1', question: '¿Qué contiene?', answer: 'Contenido verificable',
    createdAt: '2026-07-26T10:00:00.000Z'
  }],
  attempts: [],
  settings: []
};

test('la autorización remota exige código y contraseña juntos', async () => {
  const code = generateAccountCode();
  const first = await accountIdentity(code, 'contraseña-correcta');
  const otherPassword = await accountIdentity(code, 'contraseña-distinta');
  const otherCode = await accountIdentity(generateAccountCode(), 'contraseña-correcta');
  assert.notEqual(first.id, otherPassword.id);
  assert.notEqual(first.token, otherPassword.token);
  assert.notEqual(first.id, otherCode.id);
});

test('cancelar una restauración no reemplaza datos ni desbloquea sesión', async () => {
  const code = generateAccountCode();
  const password = 'contraseña-correcta';
  const envelope = await encryptVault(backup, accountSecret(code, password));
  let replacements = 0;
  const result = await restoreVault({
    code, password, envelope,
    confirmRestore: () => false,
    replaceData: async () => { replacements += 1; }
  });
  assert.equal(result, null);
  assert.equal(replacements, 0);
});

test('aceptar una bóveda válida restaura y devuelve la sesión después de escribir', async () => {
  const code = generateAccountCode();
  const password = 'contraseña-correcta';
  const envelope = await encryptVault(backup, accountSecret(code, password));
  let restored;
  const result = await restoreVault({
    code, password, envelope, revision: 7,
    confirmRestore: () => true,
    replaceData: async payload => { restored = payload; }
  });
  assert.deepEqual(restored, backup);
  assert.equal(result.session.revision, 7);
  assert.equal(result.session.salt, envelope.salt);
});

test('una contraseña incorrecta no confirma ni modifica datos', async () => {
  const code = generateAccountCode();
  const envelope = await encryptVault(backup, accountSecret(code, 'contraseña-correcta'));
  let touched = false;
  await assert.rejects(() => restoreVault({
    code, password: 'contraseña-errónea', envelope,
    confirmRestore: () => { touched = true; return true; },
    replaceData: async () => { touched = true; }
  }), /incorrectos/);
  assert.equal(touched, false);
});

test('el límite remoto admite el peor caso de un respaldo local aceptado', async () => {
  const code = generateAccountCode();
  const payload = { data: 'x'.repeat(MAX_BACKUP_BYTES - 32) };
  const envelope = await encryptVault(payload, accountSecret(code, 'contraseña-correcta'));
  assert.ok(new Blob([JSON.stringify(envelope)]).size < MAX_VAULT_BYTES);
});
