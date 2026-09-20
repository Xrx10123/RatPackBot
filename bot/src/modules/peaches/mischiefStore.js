import { randomUUID } from 'node:crypto';
import { and, eq, desc, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { peachesMischief } from '../../db/schema.js';

export const ESCALATION_TYPES = ['hole_extra', 'shred', 'walls', 'ruler'];
const ESCALATION_STALE_MS = 48 * 60 * 60 * 1000;

export function getActiveMischiefInChannel(channelId) {
  return db.select().from(peachesMischief).where(and(eq(peachesMischief.channelId, channelId), eq(peachesMischief.resolved, 0))).get();
}

export function getMischiefById(id) {
  return db.select().from(peachesMischief).where(eq(peachesMischief.id, id)).get();
}

export function createMischief({ guildId, channelId, type, expiresInMs }) {
  const row = {
    id: randomUUID(),
    guildId,
    channelId,
    messageId: null,
    type,
    spawnedAt: Date.now(),
    expiresAt: Date.now() + expiresInMs,
    resolved: 0,
    resolvedBy: null,
    resolvedAt: null,
  };
  db.insert(peachesMischief).values(row).run();
  return row;
}

export function setMischiefMessageId(id, messageId) {
  db.update(peachesMischief).set({ messageId }).where(eq(peachesMischief.id, id)).run();
}

export function resolveMischief(id, resolvedBy = null) {
  db.update(peachesMischief).set({ resolved: 1, resolvedBy, resolvedAt: Date.now() }).where(eq(peachesMischief.id, id)).run();
}

export function listUnresolvedForGuild(guildId) {
  return db.select().from(peachesMischief).where(and(eq(peachesMischief.guildId, guildId), eq(peachesMischief.resolved, 0))).all();
}

/** Determines the next rung of the neglected-mood escalation ladder, resetting if the last one is stale (mood recovered since). */
export function nextEscalationType(guildId) {
  // Ties on spawnedAt (same millisecond) are real — rows insert faster than
  // clock resolution — so rowid (insertion order) breaks the tie.
  const recent = db
    .select()
    .from(peachesMischief)
    .where(and(eq(peachesMischief.guildId, guildId), inArray(peachesMischief.type, ESCALATION_TYPES)))
    .orderBy(desc(peachesMischief.spawnedAt), desc(sql`rowid`))
    .limit(1)
    .get();

  if (!recent || Date.now() - recent.spawnedAt > ESCALATION_STALE_MS) return ESCALATION_TYPES[0];
  const idx = ESCALATION_TYPES.indexOf(recent.type);
  return ESCALATION_TYPES[Math.min(idx + 1, ESCALATION_TYPES.length - 1)];
}

export function resolveAllPending(guildId) {
  db.update(peachesMischief).set({ resolved: 1, resolvedAt: Date.now() }).where(and(eq(peachesMischief.guildId, guildId), eq(peachesMischief.resolved, 0))).run();
}
