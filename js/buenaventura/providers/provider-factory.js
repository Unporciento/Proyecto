import { BUENAVENTURA_PROXY_URL } from '../buenaventura-config.js';
import { GeminiProxyProvider } from './gemini-proxy-provider.js';
import { UnavailableProvider } from './unavailable-provider.js';

export function createBuenaventuraProvider({
  endpoint = BUENAVENTURA_PROXY_URL,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!endpoint) return new UnavailableProvider();
  return new GeminiProxyProvider({ endpoint, fetchImpl });
}
