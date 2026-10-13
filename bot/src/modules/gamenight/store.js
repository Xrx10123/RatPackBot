import { randomUUID } from 'node:crypto';
import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { gamenightGames, gamenightPolls } from '../../db/schema.js';

export function listGames(guildId) {
  return db.select().from(gamenightGames).where(eq(gamenightGames.guildId, guildId)).orderBy(sql`${gamenightGames.name} COLLATE NOCASE`).all();
}

export function getGame(id) {
  return db.select().from(gamenightGames).where(eq(gamenightGames.id, id)).get() ?? null;
}

export function findGameByName(guildId, name) {
  return db
    .select()
    .from(gamenightGames)
    .where(and(eq(gamenightGames.guildId, guildId), sql`${gamenightGames.name} = ${name} COLLATE NOCASE`))
    .get() ?? null;
}

/** Returns the new row, or null if a game by that name (any case) is already listed. */
export function addGame({ guildId, name, minPlayers = null, maxPlayers = null, addedBy }) {
  const row = { id: randomUUID().slice(0, 12), guildId, name, minPlayers, maxPlayers, addedBy, addedAt: Date.now(), lastPlayedAt: null };
  const result = db.insert(gamenightGames).values(row).onConflictDoNothing().run();
  return result.changes > 0 ? row : null;
}

export function removeGame(guildId, id) {
  return db.delete(gamenightGames).where(and(eq(gamenightGames.guildId, guildId), eq(gamenightGames.id, id))).run().changes > 0;
}

export function markPlayed(id, when = Date.now()) {
  db.update(gamenightGames).set({ lastPlayedAt: when }).where(eq(gamenightGames.id, id)).run();
}

// --- polls ---

function hydratePoll(row) {
  return row ? { ...row, options: JSON.parse(row.options), votes: JSON.parse(row.votes) } : null;
}

export function createPoll({ guildId, channelId, createdBy, options, durationMs }) {
  const row = { id: randomUUID().slice(0, 10), guildId, channelId, messageId: null, createdBy, options: JSON.stringify(options), votes: '{}', endsAt: Date.now() + durationMs, closed: 0 };
  db.insert(gamenightPolls).values(row).run();
  return hydratePoll(row);
}

export function getPoll(id) {
  return hydratePoll(db.select().from(gamenightPolls).where(eq(gamenightPolls.id, id)).get());
}

export function setPollMessage(id, messageId) {
  db.update(gamenightPolls).set({ messageId }).where(eq(gamenightPolls.id, id)).run();
}

export function saveVotes(id, votes) {
  db.update(gamenightPolls).set({ votes: JSON.stringify(votes) }).where(eq(gamenightPolls.id, id)).run();
}

/** Closes a poll; true only for the caller that actually closed it. */
export function closePoll(id) {
  return db.update(gamenightPolls).set({ closed: 1 }).where(and(eq(gamenightPolls.id, id), eq(gamenightPolls.closed, 0))).run().changes > 0;
}

export function listExpiredPolls(now = Date.now()) {
  return db.select().from(gamenightPolls).where(and(eq(gamenightPolls.closed, 0), lt(gamenightPolls.endsAt, now))).all().map(hydratePoll);
}
