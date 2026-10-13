import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { hoards, hoardTracks } from '../../db/schema.js';

export function createHoard({ guildId, ownerId, name, isPublic = false }) {
  const row = {
    id: randomUUID(),
    guildId,
    ownerId,
    name,
    isPublic: isPublic ? 1 : 0,
    createdAt: Date.now(),
  };
  db.insert(hoards).values(row).run();
  return row;
}

export const COMMUNITY_FAVORITES_NAME = 'Community Favorites';

/** Hoards owned by the server itself (Community Favorites, Peaches' Hoard) rather than a person. */
export function isCommunityOwned(hoard) {
  return Boolean(hoard?.ownerId?.includes(':'));
}

/** The shared, guild-wide "liked songs" hoard — created on first use, one per guild. */
export function ensureCommunityFavorites(guildId) {
  // Matched on owner, not just name — a member's own hoard that happens to
  // be called "Community Favorites" must not swallow everyone's ❤️s.
  const ownerId = `community:${guildId}`;
  const existing = db.select().from(hoards).where(and(eq(hoards.guildId, guildId), eq(hoards.ownerId, ownerId))).get();
  if (existing) return existing;
  return createHoard({ guildId, ownerId, name: COMMUNITY_FAVORITES_NAME, isPublic: true });
}

export function isTrackInHoard(hoardId, uri) {
  return Boolean(db.select().from(hoardTracks).where(and(eq(hoardTracks.hoardId, hoardId), eq(hoardTracks.uri, uri))).get());
}

/** Hoards a user can see: their own (any visibility) + everyone else's public ones. */
export function listVisibleHoards(guildId, userId) {
  return db
    .select()
    .from(hoards)
    .where(and(eq(hoards.guildId, guildId), sql`(${hoards.ownerId} = ${userId} OR ${hoards.isPublic} = 1)`))
    .all();
}

export function listPublicHoards(guildId, limit = 25) {
  return db
    .select()
    .from(hoards)
    .where(and(eq(hoards.guildId, guildId), eq(hoards.isPublic, 1)))
    .limit(limit)
    .all();
}

/**
 * Looks up a hoard the user can see by name. Names are only unique per
 * owner, so when both the user's own hoard and someone else's public one
 * share a name, the user's own always wins (it's the one they can edit).
 */
export function getHoardByName(guildId, userId, name) {
  return db
    .select()
    .from(hoards)
    .where(and(eq(hoards.guildId, guildId), eq(hoards.name, name), sql`(${hoards.ownerId} = ${userId} OR ${hoards.isPublic} = 1)`))
    .orderBy(sql`CASE WHEN ${hoards.ownerId} = ${userId} THEN 0 ELSE 1 END`)
    .get();
}

/** Only the user's own hoard by that name — used for "you already have one" checks. */
export function getOwnHoardByName(guildId, userId, name) {
  return db
    .select()
    .from(hoards)
    .where(and(eq(hoards.guildId, guildId), eq(hoards.name, name), eq(hoards.ownerId, userId)))
    .get();
}

export function getHoardById(hoardId) {
  return db.select().from(hoards).where(eq(hoards.id, hoardId)).get();
}

export function renameHoard(hoardId, name) {
  db.update(hoards).set({ name }).where(eq(hoards.id, hoardId)).run();
}

export function deleteHoard(hoardId) {
  db.delete(hoardTracks).where(eq(hoardTracks.hoardId, hoardId)).run();
  db.delete(hoards).where(eq(hoards.id, hoardId)).run();
}

export function getHoardTracks(hoardId) {
  return db.select().from(hoardTracks).where(eq(hoardTracks.hoardId, hoardId)).orderBy(hoardTracks.position).all();
}

export function addTrackToHoard(hoardId, track) {
  const [{ nextPosition } = { nextPosition: 0 }] = db
    .select({ nextPosition: sql`COALESCE(MAX(${hoardTracks.position}), -1) + 1` })
    .from(hoardTracks)
    .where(eq(hoardTracks.hoardId, hoardId))
    .all();

  const row = {
    id: randomUUID(),
    hoardId,
    position: nextPosition,
    title: track.info.title,
    artist: track.info.author,
    uri: track.info.uri,
    duration: track.info.duration,
    source: track.info.sourceName ?? null,
  };
  db.insert(hoardTracks).values(row).run();
  return row;
}

/** Returns true if a track was actually removed. */
export function removeTrackFromHoard(hoardId, position) {
  const result = db.delete(hoardTracks).where(and(eq(hoardTracks.hoardId, hoardId), eq(hoardTracks.position, position))).run();
  return result.changes > 0;
}

export function clearHoardTracks(hoardId) {
  db.delete(hoardTracks).where(eq(hoardTracks.hoardId, hoardId)).run();
}

/**
 * Re-resolves stored (uri/title/artist) rows into playable Lavalink tracks.
 * Hoards don't store encoded track strings, so links are re-resolved on load —
 * this also self-heals dead links (a failed row is just skipped).
 */
const RESOLVE_CONCURRENCY = 5;

export async function resolveHoardTracks(player, rows, requester) {
  // A few lookups in flight at once — strictly one-at-a-time made a 50-track
  // hoard take most of a minute — while keeping the hoard's order intact.
  const resolved = new Array(rows.length).fill(null);
  let next = 0;

  async function worker() {
    while (next < rows.length) {
      const i = next++;
      const row = rows[i];
      const query = row.uri || `ytsearch:${[row.title, row.artist].filter(Boolean).join(' ')}`;
      try {
        const result = await player.search({ query }, requester);
        if (result?.tracks?.length) resolved[i] = result.tracks[0];
      } catch {
        // dead link or source outage — skip and keep loading the rest
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(RESOLVE_CONCURRENCY, rows.length) }, worker));
  return resolved.filter(Boolean);
}
