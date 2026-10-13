import { randomUUID } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { peachesGames } from '../../../db/schema.js';

function hydrate(row) {
  return row ? { ...row, data: JSON.parse(row.data || '{}') } : null;
}

export function createGame({ guildId, type, channelId, data = {}, durationMs }) {
  const row = {
    id: randomUUID().slice(0, 12),
    guildId,
    type,
    channelId,
    messageId: null,
    data: JSON.stringify(data),
    startedAt: Date.now(),
    expiresAt: Date.now() + durationMs,
    resolved: 0,
    winnerId: null,
  };
  db.insert(peachesGames).values(row).run();
  return hydrate(row);
}

export function getGame(id) {
  return hydrate(db.select().from(peachesGames).where(eq(peachesGames.id, id)).get());
}

/** The unresolved game of this type in the guild, if any (one at a time per type). */
export function getActiveGame(guildId, type) {
  return hydrate(
    db
      .select()
      .from(peachesGames)
      .where(and(eq(peachesGames.guildId, guildId), eq(peachesGames.type, type), eq(peachesGames.resolved, 0)))
      .get(),
  );
}

export function setGameMessage(id, messageId) {
  db.update(peachesGames).set({ messageId }).where(eq(peachesGames.id, id)).run();
}

export function saveGameData(id, data) {
  db.update(peachesGames).set({ data: JSON.stringify(data) }).where(eq(peachesGames.id, id)).run();
}

/**
 * Marks a game finished. Returns true only for the caller that actually
 * flipped it — so when two people click the right answer at once, or a
 * timer and the sweep both try to close a game, exactly one wins.
 */
export function resolveGame(id, winnerId = null) {
  const result = db
    .update(peachesGames)
    .set({ resolved: 1, winnerId })
    .where(and(eq(peachesGames.id, id), eq(peachesGames.resolved, 0)))
    .run();
  return result.changes > 0;
}

export function listExpiredGames(now = Date.now()) {
  return db
    .select()
    .from(peachesGames)
    .where(and(eq(peachesGames.resolved, 0), lt(peachesGames.expiresAt, now)))
    .all()
    .map(hydrate);
}

/** Fetches the game's message, or null if it (or its channel) is gone. */
export async function fetchGameMessage(client, game) {
  if (!game?.messageId) return null;
  const channel = await client.channels.fetch(game.channelId).catch(() => null);
  return channel?.messages?.fetch(game.messageId).catch(() => null) ?? null;
}

/** setTimeout that won't keep the process alive (the sweep is the backstop after a restart). */
export function later(ms, fn) {
  const timer = setTimeout(() => Promise.resolve(fn()).catch(() => {}), ms);
  timer.unref?.();
  return timer;
}
