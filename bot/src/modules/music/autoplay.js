import { getGuildConfig } from '../../core/guildConfig.js';
import { logger } from '../../core/logger.js';
import { recentUris, quizPool } from './plays.js';

export const AUTOPLAY_REQUESTER = 'Autoplay 📻';

/**
 * Picks the first usable candidate: a real track, not a stream, not the
 * song that just ended, and not something played recently. Pure.
 */
export function pickAutoplayCandidate(tracks, { recent = new Set(), lastTrack = null, random = Math.random, spread = 5 } = {}) {
  const usable = (tracks ?? []).filter(
    (t) =>
      t?.info &&
      !t.info.isStream &&
      t.info.uri !== lastTrack?.info?.uri &&
      t.info.identifier !== lastTrack?.info?.identifier &&
      !recent.has(t.info.uri),
  );
  if (usable.length === 0) return null;
  // A little randomness among the best few so the radio doesn't feel deterministic.
  return usable[Math.floor(random() * Math.min(spread, usable.length))];
}

async function search(player, query) {
  try {
    const result = await player.search({ query }, AUTOPLAY_REQUESTER);
    return result?.tracks ?? [];
  } catch {
    return [];
  }
}

/**
 * Finds something to play next, trying in order:
 *   1. YouTube's own radio mix for the last song (list=RD<videoId>)
 *   2. more from the same artist
 *   3. a favourite from this server's own listening history
 */
export async function findAutoplayTrack(player, lastTrack, { random = Math.random } = {}) {
  const recent = new Set([...recentUris(player.guildId, 50), ...player.queue.previous.map((t) => t.info?.uri)].filter(Boolean));
  const opts = { recent, lastTrack, random };

  const id = lastTrack?.info?.identifier;
  if (lastTrack?.info?.sourceName === 'youtube' && id) {
    const mix = await search(player, `https://www.youtube.com/watch?v=${id}&list=RD${id}`);
    const pick = pickAutoplayCandidate(mix, opts);
    if (pick) return pick;
  }

  if (lastTrack?.info?.author) {
    const byArtist = await search(player, `ytsearch:${lastTrack.info.author.replace(/\s*-\s*Topic$/i, '')}`);
    const pick = pickAutoplayCandidate(byArtist, opts);
    if (pick) return pick;
  }

  const favourites = quizPool(player.guildId, 30).filter((r) => !recent.has(r.uri));
  if (favourites.length > 0) {
    const fav = favourites[Math.floor(random() * Math.min(10, favourites.length))];
    const [track] = await search(player, fav.uri);
    if (track) return track;
  }
  return null;
}

/**
 * lavalink-client's onEmptyQueue.autoPlayFunction: called when the queue
 * runs dry — but NOT after /stop (stopPlaying() opts out), so stopping
 * really stops. Adding a track here makes the library play it.
 */
export async function autoPlayFunction(player, lastTrack) {
  try {
    if (!getGuildConfig(player.guildId)?.autoplay || player.get('quiz')) return;
    const track = await findAutoplayTrack(player, lastTrack);
    if (track) await player.queue.add(track);
  } catch (err) {
    logger.warn({ err, guildId: player.guildId }, 'Autoplay failed');
  }
}
