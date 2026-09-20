import { KNOWN_SERVICES, checkStatuspageHost } from './providers/statuspage.js';
import { checkSteamReachability } from './providers/steam.js';

/** service_slug is either a curated key, the literal string 'steam', or a raw custom Statuspage host. */
export async function checkService(serviceSlug) {
  if (serviceSlug === 'steam') return checkSteamReachability();

  const known = KNOWN_SERVICES[serviceSlug];
  const host = known?.host ?? serviceSlug;
  return checkStatuspageHost(host);
}
