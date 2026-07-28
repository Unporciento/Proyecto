import test from 'node:test';
import assert from 'node:assert/strict';
import { BuenaventuraReadPorts } from '../js/buenaventura/buenaventura-read-ports.js';
import { buildBuenaventuraRequest } from '../js/buenaventura/buenaventura-context.js';
import { makeGraph, testRepository } from './academic-fixtures.js';

async function seeded() {
  const fixture = await testRepository(`buenaventura-${crypto.randomUUID()}`);
  await fixture.repository.createGraph(makeGraph());
  await fixture.repository.createGraph(makeGraph('project_two', 'subject_two'));
  return fixture;
}

test('los puertos listan solo contexto elegible y leen con selección explícita', async () => {
  const fixture = await seeded();
  const modes = [];
  const provider = async () => {
    const original = fixture.database.transaction.bind(fixture.database);
    return new Proxy(fixture.database, {
      get(target, key) {
        if (key !== 'transaction') return Reflect.get(target, key);
        return (stores, mode = 'readonly') => {
          modes.push(mode);
          return original(stores, mode);
        };
      }
    });
  };
  const ports = new BuenaventuraReadPorts(provider);
  const options = await ports.list('project_one');
  assert.ok(options.some(item => item.module === 'library'));
  assert.ok(options.some(item => item.module === 'rubric'));
  const fragments = await ports.fragments('project_one', [
    { module: 'rubric', id: 'project_one_criterion' },
    { module: 'evidence', id: 'project_one_evidence' },
    { module: 'report', id: 'project_one_section' }
  ]);
  assert.deepEqual(fragments.map(item => item.module), ['rubric', 'evidence', 'report']);
  assert.ok(fragments.every(item => item.projectId === 'project_one' && item.untrusted));
  assert.deepEqual(new Set(modes), new Set(['readonly']));
  fixture.database.close();
});

test('los puertos rechazan selección global, IDs cruzados y más de cuatro fragmentos', async () => {
  const fixture = await seeded();
  const ports = new BuenaventuraReadPorts(async () => fixture.database);
  await assert.rejects(() => ports.fragments('project_one', []), /uno y cuatro/);
  await assert.rejects(() => ports.fragments('project_one', [
    { module: 'evidence', id: 'project_two_evidence' }
  ]), /otro proyecto/);
  await assert.rejects(() => ports.fragments('project_one', [1, 2, 3, 4, 5].map(index => ({
    module: 'evidence', id: `evidence_${index}`
  }))), /uno y cuatro/);
  fixture.database.close();
});

test('el constructor genera contexto mixto efímero sin un module global', async () => {
  const fixture = await seeded();
  const ports = new BuenaventuraReadPorts(async () => fixture.database);
  const value = await buildBuenaventuraRequest({
    readPorts: ports,
    projectId: 'project_one',
    task: 'compare',
    selections: [
      { module: 'rubric', id: 'project_one_criterion' },
      { module: 'evidence', id: 'project_one_evidence' }
    ],
    offline: false,
    externalConsent: true,
    deidentified: true,
    adultUse: true,
    requestId: 'request_mixed'
  });
  assert.equal('module' in value, false);
  assert.deepEqual(value.fragments.map(item => item.module), ['rubric', 'evidence']);
  assert.deepEqual(value.consent, {
    externalProvider: true, deidentified: true, adultUse: true
  });
  fixture.database.close();
});
