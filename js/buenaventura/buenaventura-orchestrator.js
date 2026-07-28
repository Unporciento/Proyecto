import { validateRequest, validateResponse } from './buenaventura-contracts.js';
import {
  responseRespectsCanon,
  technicalResponse
} from './buenaventura-policy.js';
import { UnavailableProvider } from './providers/unavailable-provider.js';

export class BuenaventuraOrchestrator {
  constructor({ provider = new UnavailableProvider() } = {}) {
    this.provider = provider;
  }

  async recommend(request, { signal } = {}) {
    validateRequest(request);
    if (this.provider.external && request.consent.externalProvider !== true) {
      return technicalResponse(request.requestId, 'policy_blocked');
    }
    if (request.constraints.offline && this.provider.external) {
      return technicalResponse(request.requestId, 'offline');
    }
    try {
      const response = await this.provider.recommend(structuredClone(request), { signal });
      validateResponse(response);
      if (response.requestId !== request.requestId || !responseRespectsCanon(response.text)) {
        return technicalResponse(request.requestId, 'policy_blocked');
      }
      const fragments = new Map(request.fragments.map(item => [item.id, item]));
      if (response.references.some(reference => {
        const fragment = fragments.get(reference.fragmentId);
        return !fragment || fragment.id !== reference.id || fragment.module !== reference.module;
      })) {
        return technicalResponse(request.requestId, 'policy_blocked');
      }
      return structuredClone(response);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      return technicalResponse(request.requestId, 'provider_unavailable');
    }
  }
}
