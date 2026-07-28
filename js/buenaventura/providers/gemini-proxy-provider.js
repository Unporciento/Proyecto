import { BuenaventuraProvider } from './provider-port.js';

function proxyRequest(request) {
  return {
    schemaVersion: 'buenaventura-proxy-request-v1',
    task: request.task,
    identityStage: request.identityStage,
    activeEvaluation: request.constraints.activeEvaluation,
    consent: {
      externalProvider: request.consent.externalProvider,
      deidentified: request.consent.deidentified,
      adultUse: request.consent.adultUse
    },
    fragments: request.fragments.map((fragment, index) => ({
      alias: `F${index + 1}`,
      module: fragment.module,
      kind: fragment.kind,
      excerpt: fragment.excerpt
    }))
  };
}

function localResponse(request, payload) {
  const aliases = new Map(request.fragments.map((fragment, index) => [
    `F${index + 1}`, fragment
  ]));
  if (payload?.schemaVersion !== 'buenaventura-proxy-response-v1'
    || payload.status !== 'ok' || typeof payload.text !== 'string'
    || !Array.isArray(payload.references)) {
    throw new TypeError('Respuesta del proxy no válida.');
  }
  return {
    schemaVersion: 'buenaventura-response-v1',
    requestId: request.requestId,
    status: 'ok',
    text: payload.text,
    references: payload.references.map(alias => {
      const fragment = aliases.get(alias);
      if (!fragment) throw new TypeError('Referencia externa no válida.');
      return { fragmentId: fragment.id, module: fragment.module, id: fragment.id };
    })
  };
}

export class GeminiProxyProvider extends BuenaventuraProvider {
  constructor({ endpoint, fetchImpl = globalThis.fetch } = {}) {
    super({ external: true });
    let url;
    try {
      url = new URL(endpoint);
    } catch {
      throw new TypeError('El proxy de Buenaventura no está configurado.');
    }
    if (url.protocol !== 'https:' || url.username || url.password
      || url.search || url.hash
      || url.pathname !== '/v1/buenaventura/recommend'
      || typeof fetchImpl !== 'function') {
      throw new TypeError('El proxy de Buenaventura no está configurado.');
    }
    this.endpoint = url.href;
    this.fetchImpl = fetchImpl;
  }

  async recommend(request, { signal } = {}) {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(proxyRequest(request)),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal
    });
    if (!response.ok) throw new Error(`Proxy no disponible (${response.status}).`);
    return localResponse(request, await response.json());
  }
}
