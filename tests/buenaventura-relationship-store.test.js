import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { validateBackup } from '../js/backup.js';
import * as db from '../js/db.js';
import {
  RELATIONSHIP_SETTING_KEY,
  defaultRelationship
} from '../js/buenaventura/relationship/relationship-contracts.js';
import { RelationshipStore } from '../js/buenaventura/relationship/relationship-store.js';

function backup(version = 2, relationship = defaultRelationship()) {
  const value = {
    version,
    subjects: [],
    documents: [],
    cards: [],
    attempts: [],
    settings: [{ key: RELATIONSHIP_SETTING_KEY, value: relationship }]
  };
  if (version === 2) {
    Object.assign(value, {
      academicProjects: [],
      projectArtifacts: [],
      artifactRelations: [],
      artifactRevisions: []
    });
  }
  return value;
}

test('el store persiste solo la clave global cerrada y puede eliminarla', async () => {
  const memory = new Map();
  const store = new RelationshipStore({
    readSettings: async () => Object.fromEntries(memory),
    writeSettings: async values => {
      Object.entries(values).forEach(([key, value]) => memory.set(key, value));
    },
    removeSetting: async key => memory.delete(key)
  });
  assert.deepEqual(await store.load(), defaultRelationship());
  const enabled = { ...defaultRelationship(), evolutionEnabled: true };
  await store.save(enabled);
  assert.deepEqual([...memory.keys()], [RELATIONSHIP_SETTING_KEY]);
  assert.equal((await store.load()).evolutionEnabled, true);
  assert.deepEqual(await store.clear(), defaultRelationship());
  assert.equal(memory.size, 0);
});

test('respaldo v2 admite relación sin cambiar versión y v1 se convierte en memoria', () => {
  const v2 = validateBackup(backup());
  assert.equal(v2.version, 2);
  assert.equal(v2.settings[0].value.stage, 'professor_buenaventura');
  const originalV1 = backup(1);
  const restored = validateBackup(originalV1);
  assert.equal(restored.version, 2);
  assert.equal(restored.settings[0].value.evolutionEnabled, false);
  assert.equal(originalV1.version, 1);
  assert.equal('academicProjects' in originalV1, false);
});

test('respaldo rechaza corrupción, campos, etapa imposible y fecha inválida', () => {
  const cases = [
    { ...defaultRelationship(), score: 1 },
    { ...defaultRelationship(), stage: 'tura_superior' },
    {
      ...defaultRelationship(),
      milestoneEvidence: {
        ...defaultRelationship().milestoneEvidence,
        lastObservationDay: '2026-02-31'
      }
    },
    {
      ...defaultRelationship(),
      milestoneEvidence: {
        ...defaultRelationship().milestoneEvidence,
        families: ['attempt_before_help', 'attempt_before_help']
      }
    }
  ];
  cases.forEach(value => assert.throws(() => validateBackup(backup(2, value))));
});

test('una relación corrupta aborta antes de reemplazar la base', async () => {
  await db.clearAll();
  await db.put('subjects', { id: 'subject_safe', name: 'Conservar' });
  const corrupt = backup(1, {
    ...defaultRelationship(),
    milestoneEvidence: {
      ...defaultRelationship().milestoneEvidence,
      lastObservationDay: 'fecha-imposible'
    }
  });
  await assert.rejects(() => db.replaceAll(corrupt), /lastObservationDay/);
  assert.deepEqual((await db.all('subjects')).map(item => item.id), ['subject_safe']);
});
