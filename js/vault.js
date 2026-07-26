const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ITERATIONS = 210_000;

function bytesToBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? ENCODER.encode(value) : value));
}

export function normalizeAccountCode(value = '') {
  return value.toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, '');
}

export function accountSecret(code, password) {
  const normalized = normalizeAccountCode(code);
  if (normalized.length !== 20) throw new Error('El código de cuenta debe tener 20 caracteres.');
  return `forja-vault-v1:${normalized}:${password}`;
}

export function generateAccountCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const characters = [...bytes].map(byte => ALPHABET[byte % ALPHABET.length]).join('');
  return characters.match(/.{1,5}/g).join('-');
}

export async function accountIdentity(code, password) {
  const normalized = normalizeAccountCode(code);
  if (normalized.length !== 20) throw new Error('El código de cuenta debe tener 20 caracteres.');
  if (typeof password !== 'string' || password.length < 10) throw new Error('Usa una contraseña de al menos 10 caracteres.');
  const tokenBytes = await sha256(`forja-write-v2:${normalized}:${password}`);
  const token = bytesToBase64(tokenBytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const idBytes = await sha256(token);
  const id = bytesToBase64(idBytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return { id, token };
}

async function deriveKey(password, salt) {
  if (password.length < 10) throw new Error('Usa una contraseña de al menos 10 caracteres.');
  const material = await crypto.subtle.importKey('raw', ENCODER.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptVault(payload, password, existingSalt = null) {
  const salt = existingSalt ? base64ToBytes(existingSalt) : crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plaintext = ENCODER.encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { version: 1, algorithm: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(encrypted)), updatedAt: new Date().toISOString() };
}

export async function decryptVault(envelope, password) {
  if (!envelope || envelope.version !== 1 || envelope.iterations !== ITERATIONS) throw new Error('La bóveda no es compatible con esta versión.');
  try {
    const salt = base64ToBytes(envelope.salt);
    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(envelope.iv) }, key, base64ToBytes(envelope.ciphertext));
    return JSON.parse(DECODER.decode(decrypted));
  } catch { throw new Error('Código, contraseña o bóveda incorrectos.'); }
}
