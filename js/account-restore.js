import { validateBackup } from './backup.js';
import { accountIdentity, accountSecret, decryptVault } from './vault.js';

export async function restoreVault({ code, password, envelope, revision = null, confirmRestore, replaceData }) {
  const vaultKey = accountSecret(code, password);
  const payload = validateBackup(await decryptVault(envelope, vaultKey));
  const accepted = await confirmRestore(payload);
  if (!accepted) return null;

  await replaceData(payload);
  const identity = await accountIdentity(code, password);
  return {
    payload,
    session: { ...identity, vaultKey, salt: envelope.salt, revision }
  };
}

