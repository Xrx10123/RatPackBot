import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { gameNewsSubscriptions } from '../../db/schema.js';

export function listSubscriptions(guildId) {
  return db.select().from(gameNewsSubscriptions).where(eq(gameNewsSubscriptions.guildId, guildId)).all();
}

export function getSubscriptionByAppId(guildId, appid) {
  return db
    .select()
    .from(gameNewsSubscriptions)
    .where(and(eq(gameNewsSubscriptions.guildId, guildId), eq(gameNewsSubscriptions.steamAppid, String(appid))))
    .get();
}

export function getSubscriptionByName(guildId, gameName) {
  return db
    .select()
    .from(gameNewsSubscriptions)
    .where(and(eq(gameNewsSubscriptions.guildId, guildId), eq(gameNewsSubscriptions.gameName, gameName)))
    .get();
}

export function getSubscriptionById(id) {
  return db.select().from(gameNewsSubscriptions).where(eq(gameNewsSubscriptions.id, id)).get();
}

export function listAllEnabled() {
  return db.select().from(gameNewsSubscriptions).where(eq(gameNewsSubscriptions.enabled, 1)).all();
}

export function addSubscription({ guildId, gameName, steamAppid }) {
  const row = { id: randomUUID(), guildId, gameName, steamAppid: String(steamAppid), enabled: 1, tagFilter: null, lastCheckedAt: Date.now() };
  db.insert(gameNewsSubscriptions).values(row).run();
  return row;
}

export function removeSubscription(id) {
  db.delete(gameNewsSubscriptions).where(eq(gameNewsSubscriptions.id, id)).run();
}

export function setEnabled(id, enabled) {
  db.update(gameNewsSubscriptions).set({ enabled: enabled ? 1 : 0 }).where(eq(gameNewsSubscriptions.id, id)).run();
}

export function setTagFilter(id, tagFilter) {
  db.update(gameNewsSubscriptions).set({ tagFilter }).where(eq(gameNewsSubscriptions.id, id)).run();
}

export function updateLastChecked(id, timestamp) {
  db.update(gameNewsSubscriptions).set({ lastCheckedAt: timestamp }).where(eq(gameNewsSubscriptions.id, id)).run();
}
