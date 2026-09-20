import { fetchJson } from '../../../utils/httpJson.js';

/**
 * Steam has no real public health/status endpoint — ISteamWebAPIUtil/
 * GetServerInfo (what the plan cites) only returns the current server time,
 * not any actual subsystem health. This uses it as a bare reachability
 * check instead of claiming it measures "Valve backend health": if the
 * Steam Web API gateway itself doesn't respond, something's genuinely
 * wrong; if it does respond, that only proves the gateway is up, not that
 * the store/community/matchmaking are healthy.
 */
export async function checkSteamReachability() {
  try {
    const data = await fetchJson('https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/');
    return { name: 'Steam', indicator: data.servertime ? 'none' : 'major', description: data.servertime ? 'API reachable' : 'Unreachable' };
  } catch {
    return { name: 'Steam', indicator: 'major', description: 'API unreachable' };
  }
}
