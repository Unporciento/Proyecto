const DB_NAME = 'forja-estudio';
const DB_VERSION = 2;
const STORES = ['subjects', 'documents', 'cards', 'attempts', 'settings'];

let database;

function openDatabase() {
  if (database) return Promise.resolve(database);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('subjects')) {
        db.createObjectStore('subjects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('documents')) {
        const docs = db.createObjectStore('documents', { keyPath: 'id' });
        docs.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('cards')) {
        const cards = db.createObjectStore('cards', { keyPath: 'id' });
        cards.createIndex('docId', 'docId');
        cards.createIndex('dueAt', 'dueAt');
      }
      if (!db.objectStoreNames.contains('attempts')) {
        const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
        attempts.createIndex('cardId', 'cardId');
        attempts.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => { database = request.result; resolve(database); };
    request.onerror = () => reject(request.error);
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(name, mode = 'readonly') {
  const db = await openDatabase();
  return db.transaction(name, mode).objectStore(name);
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
  const data = { version: 1, exportedAt: new Date().toISOString() };
  for (const name of STORES) data[name] = await all(name);
  return data;
}

export async function clearAll() {
  const db = await openDatabase();
  await Promise.all(STORES.map(name => new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    tx.objectStore(name).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  })));
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}
