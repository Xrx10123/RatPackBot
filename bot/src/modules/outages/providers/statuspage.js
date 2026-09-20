import { fetchJson } from '../../../utils/httpJson.js';

/**
 * The build plan's monitoring system was designed around a "DownStatus API"
 * (free, no key, crowdsourced + official statuses, searchable catalog of
 * hundreds of services). No such public API could be confirmed to exist —
 * the closest real match, isitdownstatus.com, is a browser-facing
 * crowdsourced checker with no documented API, and scraping it would carry
 * the same ToS risk the plan explicitly ruled out for DBD player stats.
 *
 * Instead this is built on Atlassian Statuspage (statuspage.io), a real,
 * standardized status-page platform used by hundreds of real companies —
 * verified live against Discord, Cloudflare, Reddit, Epic Games, Twitch,
 * and Spotify. Any Statuspage-powered service can be monitored, not just
 * the curated list below; /outage add validates unknown hosts live.
 */
export const KNOWN_SERVICES = {
  discord: { name: 'Discord', host: 'discordstatus.com' },
  cloudflare: { name: 'Cloudflare', host: 'www.cloudflarestatus.com' },
  reddit: { name: 'Reddit', host: 'www.redditstatus.com' },
  epicgames: { name: 'Epic Games', host: 'status.epicgames.com' },
  twitch: { name: 'Twitch', host: 'status.twitch.tv' },
  spotify: { name: 'Spotify', host: 'spotify.statuspage.io' },
};

export async function checkStatuspageHost(host) {
  const data = await fetchJson(`https://${host}/api/v2/status.json`);
  return {
    name: data.page?.name ?? host,
    indicator: data.status?.indicator ?? 'none', // 'none' | 'minor' | 'major' | 'critical'
    description: data.status?.description ?? 'Unknown',
  };
}

/** Validates that a host is actually a working Statuspage instance before saving it. */
export async function validateStatuspageHost(host) {
  try {
    const result = await checkStatuspageHost(host);
    return { ok: true, name: result.name };
  } catch {
    return { ok: false };
  }
}

export function isUp(indicator) {
  return indicator === 'none';
}
