import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  ACADEMIC_STORES,
  ACADEMIC_DB_VERSION,
  TARGET_DB_VERSION,
  openCompatibleDatabase
} from '../js/academic/academic-migrations.js';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function createV2(factory, name) {
  const request = factory.open(name, 2);
  request.onupgradeneeded = () => {
    const db = request.result;
    for (const store of ['subjects', 'documents', 'cards', 'attempts', 'settings']) {
      db.createObjectStore(store, { keyPath: store === 'settings' ? 'key' : 'id' });
    }
  };
  const db = await requestResult(request);
  const tx = db.transaction('subjects', 'readwrite');
  tx.objectStore('subjects').put({ id: 'subject_before', name: 'Existente' });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

test('el puente migra v2 a v3 sin alterar datos existentes', async () => {
  const factory = new IDBFactory();
  await createV2(factory, 'migration-v2');
  const bridge = await openCompatibleDatabase({ name: 'migration-v2', factory });
  assert.equal(bridge.version, 2);
  ACADEMIC_STORES.forEach(name => assert.equal(bridge.objectStoreNames.contains(name), false));
  const preserved = await requestResult(
    bridge.transaction('subjects').objectStore('subjects').get('subject_before')
  );
  assert.equal(preserved.name, 'Existente');
  bridge.close();

  const db = await openCompatibleDatabase({
    name: 'migration-v2',
    factory,
    targetVersion: ACADEMIC_DB_VERSION
  });
  assert.equal(db.version, ACADEMIC_DB_VERSION);
  ACADEMIC_STORES.forEach(name => assert.equal(db.objectStoreNames.contains(name), true));
  const subject = await requestResult(db.transaction('subjects').objectStore('subjects').get('subject_before'));
  assert.equal(subject.name, 'Existente');
  const relationStore = db.transaction('artifactRelations').objectStore('artifactRelations');
  assert.equal(relationStore.index('identity').unique, true);
  db.close();
});

test('el puente abre una base ya migrada y nunca solicita una versión inferior', async () => {
  const factory = new IDBFactory();
  const migrated = await openCompatibleDatabase({
    name: 'migration-current',
    factory,
    targetVersion: ACADEMIC_DB_VERSION
  });
  assert.equal(migrated.version, 3);
  migrated.close();

  const reopened = await openCompatibleDatabase({
    name: 'migration-current',
    factory,
    targetVersion: ACADEMIC_DB_VERSION
  });
  assert.equal(reopened.version, 3);
  reopened.close();

  const rollbackBridge = await openCompatibleDatabase({
    name: 'migration-current',
    factory,
    targetVersion: 2
  });
  assert.equal(rollbackBridge.version, 3);
  rollbackBridge.close();

  const production = await openCompatibleDatabase({ name: 'bridge-production', factory });
  assert.equal(TARGET_DB_VERSION, 2);
  assert.equal(production.version, 2);
  ACADEMIC_STORES.forEach(name => assert.equal(production.objectStoreNames.contains(name), false));
  assert.equal(production.objectStoreNames.contains('subjects'), true);
  production.close();
});
