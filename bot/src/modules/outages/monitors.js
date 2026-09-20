import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { outageMonitors, userOutagePrefs } from '../../db/schema.js';

export function listMonitors(guildId) {
  return db.select().from(outageMonitors).where(eq(outageMonitors.guildId, guildId)).all();
}

export function getMonitorBySlug(guildId, slug) {
  return db.select().from(outageMonitors).where(and(eq(outageMonitors.guildId, guildId), eq(outageMonitors.serviceSlug, slug))).get();
}

export function getMonitorById(id) {
  return db.select().from(outageMonitors).where(eq(outageMonitors.id, id)).get();
}

export function listAllEnabled() {
  return db.select().from(outageMonitors).where(eq(outageMonitors.enabled, 1)).all();
}

export function addMonitor({ guildId, serviceSlug, serviceName }) {
  const row = { id: randomUUID(), guildId, serviceSlug, serviceName, enabled: 1, lastStatus: null, lastCheckedAt: null, lastNotifiedAt: null };
  db.insert(outageMonitors).values(row).run();
  return row;
}

export function removeMonitor(id) {
  db.delete(outageMonitors).where(eq(outageMonitors.id, id)).run();
}

export function updateMonitorStatus(id, status) {
  db.update(outageMonitors).set({ lastStatus: status, lastCheckedAt: Date.now() }).where(eq(outageMonitors.id, id)).run();
}

export function markNotified(id) {
  db.update(outageMonitors).set({ lastNotifiedAt: Date.now() }).where(eq(outageMonitors.id, id)).run();
}

// --- Per-user personal pings --------------------------------------------
// Discord's @here can't exclude specific users, so true "opt-out of @here"
// isn't implementable. This is an opt-in *extra* personal @mention layered
// on top of the guild's default alert, scoped per service per the schema.

export function isUserOptedIn(userId, guildId, serviceSlug) {
  const row = db
    .select()
    .from(userOutagePrefs)
    .where(and(eq(userOutagePrefs.userId, userId), eq(userOutagePrefs.guildId, guildId), eq(userOutagePrefs.serviceSlug, serviceSlug)))
    .get();
  return Boolean(row?.notifyEnabled);
}

export function setUserNotify(userId, guildId, serviceSlug, enabled) {
  const existing = db
    .select()
    .from(userOutagePrefs)
    .where(and(eq(userOutagePrefs.userId, userId), eq(userOutagePrefs.guildId, guildId), eq(userOutagePrefs.serviceSlug, serviceSlug)))
    .get();

  if (existing) {
    db.update(userOutagePrefs)
      .set({ notifyEnabled: enabled ? 1 : 0 })
      .where(and(eq(userOutagePrefs.userId, userId), eq(userOutagePrefs.guildId, guildId), eq(userOutagePrefs.serviceSlug, serviceSlug)))
      .run();
  } else {
    db.insert(userOutagePrefs).values({ userId, guildId, serviceSlug, notifyEnabled: enabled ? 1 : 0 }).run();
  }
}

export function listOptedInUsers(guildId, serviceSlug) {
  return db
    .select()
    .from(userOutagePrefs)
    .where(and(eq(userOutagePrefs.guildId, guildId), eq(userOutagePrefs.serviceSlug, serviceSlug), eq(userOutagePrefs.notifyEnabled, 1)))
    .all();
}
