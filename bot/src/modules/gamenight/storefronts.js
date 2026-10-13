import { fetchJson } from '../../utils/httpJson.js';
import { normalizeForMatch } from '../../utils/fuzzy.js';

/**
 * Steam and Epic storefront lookups. These are public, keyless, and
 * undocumented, so every parser here is defensive: anything that doesn't
 * look right is skipped rather than allowed to throw.
 */

const STEAM_STORE = 'https://store.steampowered.com/api';
const EPIC_FREE = 'https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US';

export function steamStoreUrl(appid) {
  return `https://store.steampowered.com/app/${appid}`;
}

/** Best Steam match for a game name from storesearch results: exact (normalised) name first, else the top hit. */
export function pickSteamMatch(items, name) {
  const list = Array.isArray(items) ? items.filter((i) => i && i.id && i.name) : [];
  if (list.length === 0) return null;
  const want = normalizeForMatch(name);
  return list.find((i) => normalizeForMatch(i.name) === want) ?? list[0];
}

export async function searchSteam(name) {
  const params = new URLSearchParams({ term: name, cc: 'us', l: 'en' });
  const data = await fetchJson(`${STEAM_STORE}/storesearch/?${params}`);
  return (data?.items ?? []).map((i) => ({ id: String(i.id), name: i.name }));
}

/**
 * Parses an appdetails?filters=price_overview response into
 * { [appid]: { percent, final, initial, finalFormatted, initialFormatted, currency } }.
 * Free / unreleased / failed apps are simply absent.
 */
export function parseSteamPrices(json) {
  const out = {};
  for (const [appid, entry] of Object.entries(json ?? {})) {
    const p = entry?.success ? entry?.data?.price_overview : null;
    if (!p || typeof p.final !== 'number') continue;
    const money = (cents) => `$${(cents / 100).toFixed(2)}`;
    out[appid] = {
      percent: Number(p.discount_percent) || 0,
      final: p.final,
      initial: typeof p.initial === 'number' ? p.initial : p.final,
      finalFormatted: p.final_formatted || money(p.final),
      initialFormatted: p.initial_formatted || money(typeof p.initial === 'number' ? p.initial : p.final),
      currency: p.currency ?? 'USD',
    };
  }
  return out;
}

/** Prices for many apps, batched (price_overview is the one filter Steam allows for multiple appids). */
export async function getSteamPrices(appids) {
  const unique = [...new Set(appids.filter(Boolean).map(String))];
  const prices = {};
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const params = new URLSearchParams({ appids: batch.join(','), cc: 'us', filters: 'price_overview' });
    Object.assign(prices, parseSteamPrices(await fetchJson(`${STEAM_STORE}/appdetails?${params}`)));
  }
  return prices;
}

function activeOffer(groups, now) {
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const offer of Array.isArray(group?.promotionalOffers) ? group.promotionalOffers : []) {
      const start = Date.parse(offer?.startDate);
      const end = Date.parse(offer?.endDate);
      if (Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end) return { start, end, percent: offer?.discountSetting?.discountPercentage };
    }
  }
  return null;
}

/**
 * Games Epic is giving away right now, from the freeGamesPromotions
 * payload: an active promotion that takes the price to zero.
 * Returns [{ key, title, url, image, endsAt }].
 */
export function parseEpicFreeGames(json, now = Date.now()) {
  const elements = json?.data?.Catalog?.searchStore?.elements;
  if (!Array.isArray(elements)) return [];
  const games = [];
  for (const el of elements) {
    if (!el?.title) continue;
    const offer = activeOffer(el.promotions?.promotionalOffers, now);
    if (!offer) continue;
    const discountPrice = el.price?.totalPrice?.discountPrice;
    const free = offer.percent === 0 || discountPrice === 0;
    if (!free) continue;

    const slug = el.productSlug?.replace(/\/home$/, '') || el.offerMappings?.find((m) => m?.pageSlug)?.pageSlug || el.catalogNs?.mappings?.find((m) => m?.pageSlug)?.pageSlug || el.urlSlug;
    const images = Array.isArray(el.keyImages) ? el.keyImages : [];
    const image = ['OfferImageWide', 'DieselStoreFrontWide', 'Thumbnail'].map((type) => images.find((k) => k?.type === type)?.url).find(Boolean) ?? null;
    games.push({
      key: `epic:${el.id ?? slug ?? el.title}`,
      title: el.title,
      url: slug ? `https://store.epicgames.com/en-US/p/${slug}` : 'https://store.epicgames.com/en-US/free-games',
      image,
      endsAt: offer.end,
    });
  }
  return games;
}

export async function getEpicFreeGames(now = Date.now()) {
  return parseEpicFreeGames(await fetchJson(EPIC_FREE), now);
}
