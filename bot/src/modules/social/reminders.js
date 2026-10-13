import { randomUUID } from 'node:crypto';
import { and, asc, eq, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { reminders } from '../../db/schema.js';

export const MAX_ACTIVE_PER_USER = 25;

export function createReminder({ guildId, channelId, userId, text, dueAt }) {
  const row = { id: randomUUID().slice(0, 8), guildId, channelId, userId, text, dueAt, createdAt: Date.now(), delivered: 0 };
  db.insert(reminders).values(row).run();
  return row;
}

export function listUserReminders(guildId, userId) {
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.guildId, guildId), eq(reminders.userId, userId), eq(reminders.delivered, 0)))
    .orderBy(asc(reminders.dueAt))
    .all();
}

/** Only the person who set a reminder can cancel it. Returns true if one was cancelled. */
export function cancelReminder(id, userId) {
  return db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, userId), eq(reminders.delivered, 0))).run().changes > 0;
}

export function dueReminders(now = Date.now()) {
  return db.select().from(reminders).where(and(eq(reminders.delivered, 0), lte(reminders.dueAt, now))).orderBy(asc(reminders.dueAt)).all();
}

/** Claims a reminder for delivery; false if something else already did (no double pings). */
export function claimReminder(id) {
  return db.update(reminders).set({ delivered: 1 }).where(and(eq(reminders.id, id), eq(reminders.delivered, 0))).run().changes > 0;
}
