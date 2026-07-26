import { MAX_VAULT_BYTES } from '../../js/config.js';

const ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function tokenId(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return base64url(new Uint8Array(digest));
}

function cors(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || 'https://unporciento.github.io').split(',').map(value => value.trim());
  const headers = {
    'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, if-match, if-none-match',
    'access-control-max-age': '86400',
    vary: 'Origin', 'cache-control': 'no-store'
  };
  if (allowed.includes(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(request, env), 'content-type': 'application/json; charset=utf-8' } });
}

async function authenticate(request, id) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return ID_PATTERN.test(id) && token.length === 43 && await tokenId(token) === id;
}

function validEnvelope(value) {
  return value && value.version === 1 && value.algorithm === 'AES-GCM' && value.kdf === 'PBKDF2-SHA256'
    && typeof value.salt === 'string' && typeof value.iv === 'string' && typeof value.ciphertext === 'string';
}

async function handle(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, env) });
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/v1\/vaults\/([A-Za-z0-9_-]{43})$/);
  if (!match) return json(request, env, { error: 'Ruta no encontrada.' }, 404);
  const id = match[1];
  if (!await authenticate(request, id)) return json(request, env, { error: 'Cuenta o autorización incorrecta.' }, 401);

  const existing = await env.VAULTS.prepare('SELECT payload, revision, updated_at FROM vaults WHERE id = ?').bind(id).first();
  if (request.method === 'GET') {
    if (!existing) return json(request, env, { error: 'Bóveda no encontrada.' }, 404);
    return json(request, env, { envelope: JSON.parse(existing.payload), revision: existing.revision, updatedAt: existing.updated_at });
  }
  if (request.method === 'DELETE') {
    await env.VAULTS.prepare('DELETE FROM vaults WHERE id = ?').bind(id).run();
    return json(request, env, { deleted: true });
  }
  if (request.method !== 'PUT') return json(request, env, { error: 'Método no permitido.' }, 405);

  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_VAULT_BYTES) return json(request, env, { error: 'La bóveda supera 16 MB.' }, 413);
  const text = await request.text();
  if (text.length > MAX_VAULT_BYTES) return json(request, env, { error: 'La bóveda supera 16 MB.' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json(request, env, { error: 'JSON no válido.' }, 400); }
  if (!validEnvelope(body.envelope)) return json(request, env, { error: 'Bóveda no válida.' }, 400);

  const expected = request.headers.get('if-match');
  if (existing && request.headers.get('if-none-match') === '*') return json(request, env, { error: 'La cuenta ya existe. Desbloquéala antes de guardar.' }, 409);
  if (existing && expected === null) return json(request, env, { error: 'Falta la versión de sincronización.' }, 428);
  if (existing && Number(expected) !== existing.revision) return json(request, env, { error: 'Hay una versión más reciente. Descárgala antes de sobrescribir.' }, 409);
  if (!existing && expected !== null) return json(request, env, { error: 'La bóveda remota ya no existe.' }, 409);
  const revision = (existing?.revision || 0) + 1;
  const updatedAt = new Date().toISOString();
  await env.VAULTS.prepare('INSERT INTO vaults (id, payload, revision, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, revision = excluded.revision, updated_at = excluded.updated_at')
    .bind(id, JSON.stringify(body.envelope), revision, updatedAt).run();
  return json(request, env, { revision, updatedAt }, existing ? 200 : 201);
}

export default {
  fetch(request, env) {
    return handle(request, env).catch(() => json(request, env, { error: 'Error interno.' }, 500));
  }
};
