import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { playHistory } from '../../db/schema.js';

// Cap how far back the History button can page — keeps old plays around
// without the table (or the button) growing unbounded.
const HISTORY_RETENTION = 200;

export function recordHistory({ guildId, track, requesterId }) {
  db.insert(playHistory)
    .values({
      id: randomUUID(),
      guildId,
      title: track.info.title,
      artist: track.info.author,
      uri: track.info.uri,
      duration: track.info.duration,
      source: track.info.sourceName ?? null,
      requesterId: requesterId ?? null,
      playedAt: Date.now(),
    })
    .run();

  const stale = db
    .select({ id: playHistory.id })
    .from(playHistory)
    .where(eq(playHistory.guildId, guildId))
    .orderBy(desc(playHistory.playedAt))
    .offset(HISTORY_RETENTION)
    .all();
  if (stale.length > 0) {
    db.delete(playHistory)
      .where(and(eq(playHistory.guildId, guildId), inArray(playHistory.id, stale.map((r) => r.id))))
      .run();
  }
}

export function getHistoryCount(guildId) {
  const [{ count }] = db
    .select({ count: sql`COUNT(*)` })
    .from(playHistory)
    .where(eq(playHistory.guildId, guildId))
    .all();
  return Number(count);
}

export function getHistoryTracks(guildId, offset, limit) {
  return db
    .select()
    .from(playHistory)
    .where(eq(playHistory.guildId, guildId))
    .orderBy(desc(playHistory.playedAt))
    .limit(limit)
    .offset(offset)
    .all();
}
