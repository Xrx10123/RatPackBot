import { config } from '../../../config.js';
import { fetchJson } from '../../../utils/httpJson.js';

const BASE = 'https://fortnite-api.com/v2';

export function isConfigured() {
  return Boolean(config.fortnite.apiKey);
}

/** Requires FORTNITE_API_KEY — fortnite-api.com's stats endpoint is not public. */
export async function getPlayerStats(name) {
  if (!isConfigured()) throw new Error('FORTNITE_API_KEY is not configured');

  const params = new URLSearchParams({ name });
  const data = await fetchJson(`${BASE}/stats/br/v2?${params}`, {
    headers: { Authorization: config.fortnite.apiKey },
  });
  return data.data;
}
