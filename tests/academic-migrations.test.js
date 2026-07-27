import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  ACADEMIC_STORES,
  ACADEMIC_DB_VERSION,
  TARGET_DB_VERSION,
  applyMigrations,
  openCompatibleDatabase
} from '../js/academic/academic-migrations.js';

const LEGACY_STORES = ['subjects', 'documents', 'cards', 'attempts', 'settings'];
const LEGACY_ROWS = Object.freeze({
  subjects: { id: 'subject_before', name: 'Existente' },
  documents: {
    id: 'document_before', subjectId: 'subject_before',
    name: 'Apunte', text: 'Contenido conservado'
  },
  cards: {
    id: 'card_before', docId: 'document_before',
    question: 'Pregunta', answer: 'Respuesta'
  },
  attempts: {
    id: 'attempt_before', cardId: 'card_before',
    docId: 'document_before', rating: 3
  },
  settings: { key: 'themeMode', value: 'dark' }
});

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function createV2(factory, name) {
  const request = factory.open(name, 2);
  request.onupgradeneeded = () => {
    const database = request.result;
    for (const store of LEGACY_STORES) {
      database.createObjectStore(store, {
        keyPath: store === 'settings' ? 'key' : 'id'
      });
    }
  };
  const database = await requestResult(request);
  const transaction = database.transaction(LEGACY_STORES, 'readwrite');
  for (const store of LEGACY_STORES) {
    transaction.objectStore(store).put(LEGACY_ROWS[store]);
  }
  await transactionDone(transaction);
  database.close();
}

test('una instalación nueva se crea directamente en v3 con nueve stores', async () => {
  const factory = new IDBFactory();
  const database = await openCompatibleDatabase({ name: 'fresh-v3', factory });

  assert.equal(TARGET_DB_VERSION, 3);
  assert.equal(database.version, ACADEMIC_DB_VERSION);
  assert.deepEqual(
    Array.from(database.objectStoreNames).sort(),
    [...LEGACY_STORES, ...ACADEMIC_STORES].sort()
  );
  database.close();
});

test('la migración v2 a v3 conserva datos reales de los cinco stores', async () => {
  const factory = new IDBFactory();
  await createV2(factory, 'migration-v2');
  const database = await openCompatibleDatabase({ name: 'migration-v2', factory });

  assert.equal(database.version, 3);
  ACADEMIC_STORES.forEach(name =>
    assert.equal(database.objectStoreNames.contains(name), true)
  );
  for (const store of LEGACY_STORES) {
    const key = store === 'settings' ? LEGACY_ROWS[store].key : LEGACY_ROWS[store].id;
    const preserved = await requestResult(
      database.transaction(store).objectStore(store).get(key)
    );
    assert.deepEqual(preserved, LEGACY_ROWS[store]);
  }
  const relations = database.transaction('artifactRelations').objectStore('artifactRelations');
  assert.equal(relations.index('identity').unique, true);
  database.close();
});

test('la migración se ejecuta una vez y la base v3 reabre sin actualizar', async () => {
  const factory = new IDBFactory();
  await createV2(factory, 'migration-once');
  let migrationCalls = 0;
  const migrate = (...args) => {
    migrationCalls += 1;
    applyMigrations(...args);
  };

  const migrated = await openCompatibleDatabase({
    name: 'migration-once', factory, migrate
  });
  assert.equal(migrated.version, 3);
  migrated.close();

  const reopened = await openCompatibleDatabase({
    name: 'migration-once', factory, migrate
  });
  assert.equal(reopened.version, 3);
  assert.equal(migrationCalls, 1);
  reopened.close();
});

test('el puente nunca solicita una versión inferior a una base instalada', async () => {
  const factory = new IDBFactory();
  const migrated = await openCompatibleDatabase({ name: 'migration-current', factory });
  assert.equal(migrated.version, 3);
  migrated.close();

  const rollbackBridge = await openCompatibleDatabase({
    name: 'migration-current',
    factory,
    targetVersion: 2
  });
  assert.equal(rollbackBridge.version, 3);
  rollbackBridge.close();
});
