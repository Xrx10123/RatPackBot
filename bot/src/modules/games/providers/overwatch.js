import { fetchJson } from '../../../utils/httpJson.js';

const BASE = 'https://overfast-api.tekrop.fr';

/** Converts a BattleTag like "Player#1234" to OverFast's "Player-1234" id format. */
function toPlayerId(battleTag) {
  return battleTag.trim().replace('#', '-');
}

/** No API key required. Throws if the player isn't found or is private. */
export async function getPlayerSummary(battleTag) {
  const id = toPlayerId(battleTag);
  return fetchJson(`${BASE}/players/${encodeURIComponent(id)}/summary`);
}
