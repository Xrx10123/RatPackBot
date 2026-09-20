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

export function getHoardByName(guildId, userId, name) {
  return db
    .select()
    .from(hoards)
    .where(and(eq(hoards.guildId, guildId), eq(hoards.name, name), sql`(${hoards.ownerId} = ${userId} OR ${hoards.isPublic} = 1)`))
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

export function removeTrackFromHoard(hoardId, position) {
  return db.delete(hoardTracks).where(and(eq(hoardTracks.hoardId, hoardId), eq(hoardTracks.position, position))).run();
}

export function clearHoardTracks(hoardId) {
  db.delete(hoardTracks).where(eq(hoardTracks.hoardId, hoardId)).run();
}

/**
 * Re-resolves stored (uri/title/artist) rows into playable Lavalink tracks.
 * Hoards don't store encoded track strings, so links are re-resolved on load —
 * this also self-heals dead links (a failed row is just skipped).
 */
export async function resolveHoardTracks(player, rows, requester) {
  const resolved = [];
  for (const row of rows) {
    const query = row.uri || `ytsearch:${[row.title, row.artist].filter(Boolean).join(' ')}`;
    try {
      const result = await player.search({ query }, requester);
      if (result?.tracks?.length) resolved.push(result.tracks[0]);
    } catch {
      // dead link or source outage — skip and keep loading the rest
    }
  }
  return resolved;
}
