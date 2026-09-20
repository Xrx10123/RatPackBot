import { config } from '../../../config.js';
import { fetchJson } from '../../../utils/httpJson.js';

const BASE = 'https://valorant-api.com/v1';

let agentsCache = null;
let agentsCachedAt = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Static data only — no API key required. Live player stats/rank need
 * Riot's val-match-v1 / val-ranked-v1 endpoints, which aren't available on
 * a standard free dev key (Riot gates them behind production approval), so
 * that's intentionally not implemented here even when RIOT_API_KEY is set.
 */
export async function getAgents() {
  if (agentsCache && Date.now() - agentsCachedAt < CACHE_TTL_MS) return agentsCache;
  const data = await fetchJson(`${BASE}/agents?isPlayableCharacter=true`);
  agentsCache = data.data;
  agentsCachedAt = Date.now();
  return agentsCache;
}

export function hasLivePlayerStats() {
  return false;
}

export function liveStatsUnavailableReason() {
  return config.riot.apiKey
    ? "Riot's Valorant match/rank endpoints need production API access beyond a basic dev key, so live player stats aren't available yet."
    : 'Live player stats need a Riot API key, and even then Valorant match/rank data needs production API access beyond a basic dev key.';
}
