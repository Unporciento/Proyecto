import { PERMISSIONS, validateRequest } from './buenaventura-contracts.js';

export async function buildBuenaventuraRequest({
  readPorts,
  projectId,
  task,
  selections,
  activeEvaluation = false,
  offline = typeof navigator !== 'undefined' ? !navigator.onLine : false,
  externalConsent = false,
  requestId = `buenaventura_${crypto.randomUUID()}`
}) {
  const fragments = await readPorts.fragments(projectId, selections);
  const request = {
    schemaVersion: 'buenaventura-request-v1',
    requestId,
    task,
    permissions: [...PERMISSIONS],
    scope: {
      projectId,
      selectionIds: fragments.map(item => `${item.module}:${item.id}`)
    },
    fragments,
    constraints: {
      activeEvaluation: Boolean(activeEvaluation),
      offline: Boolean(offline)
    },
    consent: {
      externalProvider: Boolean(externalConsent)
    }
  };
  validateRequest(request);
  return request;
}
