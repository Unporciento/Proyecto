import { SYNC_ENDPOINT } from './sync-config.js';

function endpoint(id) {
  if (!SYNC_ENDPOINT) throw new Error('La nube segura todavía no está conectada. Usa la bóveda cifrada descargable.');
  return `${SYNC_ENDPOINT.replace(/\/$/, '')}/v1/vaults/${encodeURIComponent(id)}`;
}

async function request(id, token, options = {}) {
  const response = await fetch(endpoint(id), {
    ...options,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...options.headers }
  });
  if (response.status === 404) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No pude comunicarme con la nube segura.');
  return body;
}

export const cloudAvailable = () => Boolean(SYNC_ENDPOINT);
export const fetchVault = (id, token) => request(id, token);
export const saveVault = (id, token, envelope, revision = null) => request(id, token, {
  method: 'PUT', body: JSON.stringify({ envelope }), headers: revision ? { 'if-match': String(revision) } : { 'if-none-match': '*' }
});
