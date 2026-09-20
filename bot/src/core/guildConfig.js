import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { guilds } from '../db/schema.js';

// Lives in core/ (not modules/setup/) because the guilds row is shared,
// cross-cutting state — games, outages, and Peaches all read from it too.
export const CHANNEL_PURPOSES = {
  panel: { label: 'Music Fallback', emoji: '🎵', field: 'panelChannelId', defaultName: 'rat-nest' },
  news: { label: 'Game News', emoji: '📰', field: 'newsChannelId', defaultName: 'game-updates' },
  outage: { label: 'Server Status', emoji: '🚨', field: 'outageChannelId', defaultName: 'server-status' },
  log: { label: 'Logs', emoji: '📋', field: 'logChannelId', defaultName: 'ratpack-logs' },
};

export function getGuildConfig(guildId) {
  return db.select().from(guilds).where(eq(guilds.id, guildId)).get();
}

export function ensureGuildConfig(guildId) {
  const existing = getGuildConfig(guildId);
  if (existing) return existing;
  const row = { id: guildId, timezone: 'UTC', flavorEnabled: 1, createdAt: Date.now() };
  db.insert(guilds).values(row).run();
  return row;
}

export function updateGuildConfig(guildId, patch) {
  ensureGuildConfig(guildId);
  db.update(guilds).set(patch).where(eq(guilds.id, guildId)).run();
  return getGuildConfig(guildId);
}

export function isSetupComplete(guildConfig) {
  if (!guildConfig) return false;
  return Object.values(CHANNEL_PURPOSES).every((p) => Boolean(guildConfig[p.field]));
}
