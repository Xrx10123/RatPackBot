import { config } from '../../../config.js';
import { fetchJson } from '../../../utils/httpJson.js';
import { fuzzySearch } from '../../../utils/fuzzy.js';

const BASE = 'https://api.steampowered.com';

let appListCache = null; // [{appid, name}]
let appListCachedAt = 0;
const APP_LIST_TTL_MS = 6 * 60 * 60 * 1000;

export function isAppListConfigured() {
  return Boolean(config.steam.apiKey);
}

/**
 * Full Steam app catalog (~150k entries), paginated. The plan assumed the
 * classic ISteamApps/GetAppList/v2 endpoint (no key) — that endpoint has
 * since been removed by Valve entirely (confirmed: it 404s with "Method
 * 'GetAppList' not found"). Its replacement, IStoreService/GetAppList,
 * requires STEAM_API_KEY, so the whole game-name-to-AppID resolution system
 * (used by /news) now needs that key, contrary to the plan's "Tier 1,
 * zero-setup" assumption. Cached for 6h once fetched.
 */
export async function getAppList() {
  if (appListCache && Date.now() - appListCachedAt < APP_LIST_TTL_MS) return appListCache;
  const key = requireApiKey();

  const apps = [];
  let lastAppId = 0;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      key,
      include_games: 'true',
      include_dlc: 'false',
      include_software: 'false',
      include_videos: 'false',
      include_hardware: 'false',
      max_results: '50000',
      last_appid: String(lastAppId),
    });
    const data = await fetchJson(`${BASE}/IStoreService/GetAppList/v1/?${params}`);
    const page = data.response?.apps ?? [];
    apps.push(...page.filter((a) => a.name?.trim()));
    hasMore = Boolean(data.response?.have_more_results);
    lastAppId = data.response?.last_appid ?? 0;
    if (page.length === 0) break;
  }

  appListCache = apps;
  appListCachedAt = Date.now();
  return appListCache;
}

export async function searchApps(query, limit = 25) {
  const apps = await getAppList();
  if (/^\d+$/.test(query.trim())) {
    const exact = apps.find((a) => String(a.appid) === query.trim());
    if (exact) return [exact];
  }
  return fuzzySearch(query, apps, { key: (a) => a.name, limit });
}

export async function getAppById(appid) {
  const apps = await getAppList();
  return apps.find((a) => String(a.appid) === String(appid)) ?? null;
}

/** No API key required. */
export async function getNewsForApp(appid, { count = 5, tags = [] } = {}) {
  const params = new URLSearchParams({ appid: String(appid), count: String(count), maxlength: '400' });
  if (tags.length > 0) params.set('tags', tags.join(','));
  const data = await fetchJson(`${BASE}/ISteamNews/GetNewsForApp/v2/?${params}`);
  return data.appnews?.newsitems ?? [];
}

function requireApiKey() {
  if (!config.steam.apiKey) throw new Error('STEAM_API_KEY is not configured');
  return config.steam.apiKey;
}

export async function resolveVanityUrl(vanity) {
  const key = requireApiKey();
  const params = new URLSearchParams({ key, vanityurl: vanity });
  const data = await fetchJson(`${BASE}/ISteamUser/ResolveVanityURL/v1/?${params}`);
  return data.response?.success === 1 ? data.response.steamid : null;
}

export async function getPlayerSummary(steamId64) {
  const key = requireApiKey();
  const params = new URLSearchParams({ key, steamids: steamId64 });
  const data = await fetchJson(`${BASE}/ISteamUser/GetPlayerSummaries/v2/?${params}`);
  return data.response?.players?.[0] ?? null;
}
