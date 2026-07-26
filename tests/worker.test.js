import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../sync-worker/src/index.js';
import { accountIdentity, generateAccountCode } from '../js/vault.js';

class MemoryD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    return {
      bind: (...values) => ({
        first: async () => this.rows.get(values[0]) || null,
        run: async () => {
          if (sql.startsWith('DELETE')) this.rows.delete(values[0]);
          else this.rows.set(values[0], { payload: values[1], revision: values[2], updated_at: values[3] });
          return { success: true };
        }
      })
    };
  }
}

const envelope = {
  version: 1, algorithm: 'AES-GCM', kdf: 'PBKDF2-SHA256',
  salt: 'salt', iv: 'iv', ciphertext: 'ciphertext'
};

function request(id, token, options = {}) {
  return new Request(`https://forja-sync.example/v1/vaults/${id}`, {
    method: options.method || 'GET',
    headers: {
      origin: options.origin || 'https://unporciento.github.io',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...options.headers
    },
    body: options.body
  });
}

test('el Worker autentica, controla revisiones y limita CORS al origen permitido', async () => {
  const code = generateAccountCode();
  const identity = await accountIdentity(code, 'contraseña-correcta');
  const env = { VAULTS: new MemoryD1(), ALLOWED_ORIGINS: 'https://unporciento.github.io' };

  const created = await worker.fetch(request(identity.id, identity.token, {
    method: 'PUT', headers: { 'if-none-match': '*' }, body: JSON.stringify({ envelope })
  }), env);
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('access-control-allow-origin'), 'https://unporciento.github.io');
  assert.equal((await created.json()).revision, 1);

  const fetched = await worker.fetch(request(identity.id, identity.token), env);
  assert.equal(fetched.status, 200);
  assert.deepEqual((await fetched.json()).envelope, envelope);

  const stale = await worker.fetch(request(identity.id, identity.token, {
    method: 'PUT', headers: { 'if-match': '0' }, body: JSON.stringify({ envelope })
  }), env);
  assert.equal(stale.status, 409);

  const wrong = await accountIdentity(code, 'contraseña-incorrecta');
  assert.equal((await worker.fetch(request(identity.id, wrong.token), env)).status, 401);

  const foreignOrigin = await worker.fetch(request(identity.id, identity.token, {
    origin: 'https://malicioso.example'
  }), env);
  assert.equal(foreignOrigin.headers.get('access-control-allow-origin'), null);
});
