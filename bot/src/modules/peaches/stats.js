import { and, eq, desc, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { peachesStats } from '../../db/schema.js';

const COLUMN_BY_ACTION = {
  feed: 'cheeseFed',
  clean: 'turdsCleaned',
  investigate: 'holesInvestigated',
  wall: 'wallsKnocked',
  fealty: 'fealtyPledged',
};

function ensureRow(guildId, userId) {
  const existing = db.select().from(peachesStats).where(and(eq(peachesStats.guildId, guildId), eq(peachesStats.userId, userId))).get();
  if (existing) return existing;
  const row = { guildId, userId, cheeseFed: 0, turdsCleaned: 0, holesInvestigated: 0, wallsKnocked: 0, fealtyPledged: 0 };
  db.insert(peachesStats).values(row).run();
  return row;
}

export function incrementStat(guildId, userId, action) {
  const column = COLUMN_BY_ACTION[action];
  if (!column) return;
  ensureRow(guildId, userId);
  db
    .update(peachesStats)
    .set({ [column]: sql`${peachesStats[column]} + 1` })
    .where(and(eq(peachesStats.guildId, guildId), eq(peachesStats.userId, userId)))
    .run();
}

export function getUserStats(guildId, userId) {
  return ensureRow(guildId, userId);
}

export function getLeaderboard(guildId, category = 'cheeseFed', limit = 10) {
  const column = peachesStats[category] ?? peachesStats.cheeseFed;
  return db.select().from(peachesStats).where(eq(peachesStats.guildId, guildId)).orderBy(desc(column)).limit(limit).all();
}
