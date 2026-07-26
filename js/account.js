import { restoreVault } from './account-restore.js';
import { MAX_VAULT_BYTES } from './config.js';
import * as db from './db.js';
import { cloudAvailable, fetchVault, saveVault } from './sync-client.js';
import { accountIdentity, accountSecret, encryptVault, generateAccountCode } from './vault.js';

const $ = selector => document.querySelector(selector);
let session = null;

function downloadJson(data, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function password() {
  const value = $('#syncPassword').value;
  if (value.length < 10) throw new Error('La contraseña debe tener al menos 10 caracteres.');
  return value;
}

function showCode(code) {
  $('#recoveryCode').textContent = code;
  $('#recoveryBox').hidden = false;
}

async function createAccount(toast) {
  const secret = password();
  if (secret !== $('#syncPasswordRepeat').value) throw new Error('Las contraseñas no coinciden.');
  const code = generateAccountCode();
  const identity = await accountIdentity(code, secret);
  const vaultKey = accountSecret(code, secret);
  const envelope = await encryptVault(await db.exportData(), vaultKey);
  session = { ...identity, vaultKey, salt: envelope.salt, revision: null };
  downloadJson(envelope, `forja-boveda-${new Date().toISOString().slice(0, 10)}.json`);
  showCode(code);
  if (cloudAvailable()) {
    const result = await saveVault(identity.id, identity.token, envelope);
    session.revision = result.revision; toast('Cuenta creada y progreso cifrado en la nube.');
  } else toast('Bóveda cifrada creada. Guarda también el código de recuperación.');
  paintStatus();
}

async function unlockAccount(toast, reload) {
  const code = $('#syncCode').value;
  const secret = password();
  let envelope;
  let revision = null;
  if (cloudAvailable()) {
    const identity = await accountIdentity(code, secret);
    const result = await fetchVault(identity.id, identity.token);
    if (!result) throw new Error('No encontré una cuenta con ese código.');
    envelope = result.envelope;
    revision = result.revision;
  } else {
    const file = $('#vaultInput').files[0];
    if (!file || file.size > MAX_VAULT_BYTES) throw new Error('Selecciona una bóveda cifrada válida de hasta 16 MB.');
    envelope = JSON.parse(await file.text());
  }
  const restored = await restoreVault({
    code, password: secret, envelope, revision,
    confirmRestore: payload => confirm(`Se restaurarán ${payload.documents.length} materiales y ${payload.cards.length} preguntas. ¿Continuar?`),
    replaceData: db.replaceAll
  });
  if (!restored) return;
  session = restored.session;
  await reload(); paintStatus(); toast('Cuenta desbloqueada y progreso restaurado.');
}

async function syncNow(toast) {
  if (!session) throw new Error('Primero desbloquea la cuenta en este dispositivo.');
  const envelope = await encryptVault(await db.exportData(), session.vaultKey, session.salt);
  downloadJson(envelope, `forja-boveda-${new Date().toISOString().slice(0, 10)}.json`);
  if (!cloudAvailable()) return toast('Bóveda cifrada actualizada y descargada.');
  const result = await saveVault(session.id, session.token, envelope, session.revision);
  session.revision = result.revision; toast('Progreso cifrado y sincronizado.');
}

export async function syncIfConnected() {
  if (!session || !cloudAvailable()) return false;
  const envelope = await encryptVault(await db.exportData(), session.vaultKey, session.salt);
  const result = await saveVault(session.id, session.token, envelope, session.revision);
  session.revision = result.revision;
  return true;
}

function paintStatus() {
  $('#syncStatus').textContent = session
    ? `Desbloqueada en esta pestaña · ${cloudAvailable() ? 'nube activa' : 'bóveda portátil'}`
    : cloudAvailable() ? 'Nube disponible · cuenta bloqueada' : 'Modo portátil cifrado · nube pendiente';
  $('#syncNowBtn').disabled = !session;
}

export function setupAccount({ toast, reload }) {
  const dialog = $('#accountDialog');
  $('#accountBtn').addEventListener('click', () => { $('#settingsDialog').close('cancel'); dialog.showModal(); paintStatus(); });
  $('#createAccountBtn').addEventListener('click', async () => { try { await createAccount(toast); } catch (error) { toast(error.message, 'error'); } });
  $('#unlockAccountBtn').addEventListener('click', async () => { try { await unlockAccount(toast, reload); } catch (error) { toast(error.message, 'error'); } });
  $('#syncNowBtn').addEventListener('click', async () => { try { await syncNow(toast); } catch (error) { toast(error.message, 'error'); } });
  $('#copyRecoveryBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#recoveryCode').textContent); toast('Código copiado. Guárdalo fuera del teléfono.'); }
    catch { toast('Mantén pulsado el código para copiarlo manualmente.', 'error'); }
  });
  paintStatus();
}
