import { BuenaventuraProvider } from './provider-port.js';
import { technicalResponse } from '../buenaventura-policy.js';

export class UnavailableProvider extends BuenaventuraProvider {
  constructor() {
    super({ external: false });
  }

  async recommend(request) {
    return technicalResponse(
      request.requestId,
      request.constraints.offline ? 'offline' : 'provider_unavailable'
    );
  }
}
