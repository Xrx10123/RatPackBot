/**
 * Tier 1 (zero-setup) source resolution. Lavalink + the youtube-source /
 * LavaSrc plugins already detect URLs for SoundCloud, Bandcamp, Twitch,
 * Vimeo, direct/HTTP links, and Spotify/Apple/Deezer links (metadata-only
 * fallback to YouTube when Tier 2 credentials aren't configured — see
 * application.yml). Plain-text queries fall back to YouTube search.
 *
 * This stays a thin wrapper today; it's the seam where later chunks add
 * explicit source-priority / fallback-on-failure logic without touching
 * callers.
 */
const URL_PATTERN = /^https?:\/\//i;

export function isUrl(query) {
  return URL_PATTERN.test(query.trim());
}

/** Builds the query lavalink-client's player.search() should receive. */
export function resolveSearchQuery(query) {
  const trimmed = query.trim();
  return isUrl(trimmed) ? trimmed : `ytsearch:${trimmed}`;
}
