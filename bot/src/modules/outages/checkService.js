import { KNOWN_SERVICES, checkStatuspageHost } from './providers/statuspage.js';
import { checkSteamReachability } from './providers/steam.js';
import { normalizeStatusHost } from './alerting.js';

/** service_slug is either a curated key, the literal string 'steam', or a raw custom Statuspage host. */
export async function checkService(serviceSlug) {
  if (serviceSlug === 'steam') return checkSteamReachability();

  const known = KNOWN_SERVICES[serviceSlug];
  const host = known?.host ?? normalizeStatusHost(serviceSlug);
  if (!host) throw new Error(`Not a known service or a valid Statuspage host: ${serviceSlug}`);
  return checkStatuspageHost(host);
}
