import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { musicPlays } from '../../db/schema.js';

/** Records a track starting. Requester is a user object, a label string (autoplay/Peaches), or nothing. */
export function recordPlay(guildId, track, when = Date.now()) {
  if (!track?.info?.title) return;
  const requester = track.requester;
  db.insert(musicPlays)
    .values({
      guildId,
      title: track.info.title.slice(0, 300),
      author: track.info.author?.slice(0, 200) ?? null,
      uri: track.info.uri ?? null,
      source: track.info.sourceName ?? null,
      requesterId: requester && typeof requester === 'object' && 'id' in requester ? String(requester.id) : null,
      duration: Number.isFinite(track.info.duration) ? track.info.duration : null,
      isStream: track.info.isStream ? 1 : 0,
      playedAt: when,
    })
    .run();
}

export const PERIODS = {
  week: { label: 'this week', ms: 7 * 86_400_000 },
  month: { label: 'this month', ms: 30 * 86_400_000 },
  all: { label: 'all time', ms: null },
};

function since(guildId, period, now) {
  const ms = PERIODS[period]?.ms;
  return ms ? and(eq(musicPlays.guildId, guildId), gte(musicPlays.playedAt, now - ms)) : eq(musicPlays.guildId, guildId);
}

export function getMusicStats(guildId, period = 'month', now = Date.now(), limit = 5) {
  const where = since(guildId, period, now);
  const totals = db
    .select({ plays: sql`COUNT(*)`, ms: sql`COALESCE(SUM(CASE WHEN ${musicPlays.isStream} = 0 THEN ${musicPlays.duration} ELSE 0 END), 0)` })
    .from(musicPlays)
    .where(where)
    .get();
  const topTracks = db
    .select({ title: musicPlays.title, author: musicPlays.author, uri: musicPlays.uri, plays: sql`COUNT(*)` })
    .from(musicPlays)
    .where(where)
    .groupBy(sql`COALESCE(${musicPlays.uri}, ${musicPlays.title})`)
    .orderBy(desc(sql`COUNT(*)`), desc(sql`MAX(${musicPlays.playedAt})`))
    .limit(limit)
    .all();
  const topArtists = db
    .select({ author: musicPlays.author, plays: sql`COUNT(*)` })
    .from(musicPlays)
    .where(and(where, isNotNull(musicPlays.author), sql`${musicPlays.author} != ''`))
    .groupBy(sql`LOWER(${musicPlays.author})`)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit)
    .all();
  const topDJs = db
    .select({ userId: musicPlays.requesterId, plays: sql`COUNT(*)` })
    .from(musicPlays)
    .where(and(where, isNotNull(musicPlays.requesterId)))
    .groupBy(musicPlays.requesterId)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit)
    .all();
  return { plays: Number(totals?.plays ?? 0), listenedMs: Number(totals?.ms ?? 0), topTracks, topArtists, topDJs };
}

/** URIs played recently in this server — autoplay avoids repeating these. */
export function recentUris(guildId, limit = 50) {
  return db
    .select({ uri: musicPlays.uri })
    .from(musicPlays)
    .where(and(eq(musicPlays.guildId, guildId), isNotNull(musicPlays.uri)))
    .orderBy(desc(musicPlays.playedAt), desc(musicPlays.id))
    .limit(limit)
    .all()
    .map((r) => r.uri);
}

/**
 * Distinct songs this server has played (most-played first), usable for
 * the quiz: real songs with a link, not streams, long enough to snip from.
 */
export function quizPool(guildId, limit = 150) {
  return db
    .select({ title: sql`MAX(${musicPlays.title})`, author: sql`MAX(${musicPlays.author})`, uri: musicPlays.uri, duration: sql`MAX(${musicPlays.duration})`, plays: sql`COUNT(*)` })
    .from(musicPlays)
    .where(and(eq(musicPlays.guildId, guildId), isNotNull(musicPlays.uri), eq(musicPlays.isStream, 0), gte(musicPlays.duration, 45_000)))
    .groupBy(musicPlays.uri)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit)
    .all();
}
