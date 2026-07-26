import {
  ACADEMIC_STORES,
  TARGET_DB_VERSION,
  openCompatibleDatabase
} from './academic/academic-migrations.js';
import { validateBackup } from './backup.js';

const DB_NAME = 'forja-estudio';
const LEGACY_STORES = ['subjects', 'documents', 'cards', 'attempts', 'settings'];
const STORES = [...LEGACY_STORES, ...ACADEMIC_STORES];

let database;

function openDatabase() {
  if (database) return Promise.resolve(database);
  return openCompatibleDatabase({ name: DB_NAME, targetVersion: TARGET_DB_VERSION })
    .then(result => {
      database = result;
      database.onversionchange = () => {
        database.close();
        database = undefined;
      };
      return database;
    });
}

export function openForjaDatabase() {
  return openDatabase();
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(name, mode = 'readonly') {
  if (!LEGACY_STORES.includes(name)) {
    throw new TypeError('Los datos académicos solo se gestionan mediante su repositorio.');
  }
  const db = await openDatabase();
  return db.transaction(name, mode).objectStore(name);
}

async function allRows(name) {
  const db = await openDatabase();
  return requestResult(db.transaction(name).objectStore(name).getAll());
}

function availableStores(db) {
  return STORES.filter(name => db.objectStoreNames.contains(name));
}

export async function put(name, value) {
  return requestResult((await store(name, 'readwrite')).put(value));
}

export async function putMany(name, values) {
  if (!values.length) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    const target = tx.objectStore(name);
    values.forEach(value => target.put(value));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function putMaterial(document, cards) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['documents', 'cards'], 'readwrite');
    tx.objectStore('documents').put(document);
    cards.forEach(card => tx.objectStore('cards').put(card));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('No se pudo guardar el material.'));
  });
}

export async function putProgress(cards, attempts) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cards', 'attempts'], 'readwrite');
    cards.forEach(card => tx.objectStore('cards').put(card));
    attempts.forEach(attempt => tx.objectStore('attempts').put(attempt));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('No se pudo guardar el progreso.'));
  });
}

export async function removeMaterial(documentId, cardIds, attemptIds) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['documents', 'cards', 'attempts'], 'readwrite');
    tx.objectStore('documents').delete(documentId);
    cardIds.forEach(id => tx.objectStore('cards').delete(id));
    attemptIds.forEach(id => tx.objectStore('attempts').delete(id));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('No se pudo eliminar el material.'));
  });
}

export async function get(name, key) {
  return requestResult((await store(name)).get(key));
}

export async function all(name) {
  return requestResult((await store(name)).getAll());
}

export async function remove(name, key) {
  return requestResult((await store(name, 'readwrite')).delete(key));
}

export async function removeByIndex(name, indexName, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    const index = tx.objectStore(name).index(indexName);
    const cursor = index.openCursor(IDBKeyRange.only(value));
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (item) { item.delete(); item.continue(); }
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSettings() {
  const rows = await all('settings');
  return Object.fromEntries(rows.map(({ key, value }) => [key, value]));
}

export async function saveSettings(values) {
  return putMany('settings', Object.entries(values).map(([key, value]) => ({ key, value })));
}

export async function exportData() {
  return exportDatabase(await openDatabase());
}

export async function exportDatabase(db) {
  const stores = availableStores(db);
  const version = ACADEMIC_STORES.every(name => stores.includes(name)) ? 2 : 1;
  const data = { version, exportedAt: new Date().toISOString() };
  for (const name of stores) {
    data[name] = await requestResult(db.transaction(name).objectStore(name).getAll());
  }
  return data;
}

export async function replaceDatabase(db, data) {
  const validated = validateBackup(data);
  const stores = availableStores(db);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    try {
      stores.forEach(name => {
        const target = tx.objectStore(name);
        target.clear();
        validated[name].forEach(value => target.put(value));
      });
    } catch (error) {
      tx.abort();
      reject(error);
    }
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('La restauración fue cancelada.'));
  });
}

export async function replaceAll(data) {
  return replaceDatabase(await openDatabase(), data);
}

export async function clearAll() {
  const db = await openDatabase();
  const stores = availableStores(db);
  await new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    stores.forEach(name => tx.objectStore(name).clear());
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('No se pudieron borrar los datos.'));
  });
}

export function closeDatabase() {
  database?.close();
  database = undefined;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}
