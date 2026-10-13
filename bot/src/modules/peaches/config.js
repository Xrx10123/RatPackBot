import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { peachesConfig } from '../../db/schema.js';
import { getGuildConfig } from '../../core/guildConfig.js';
import { isQuietHours } from './progression.js';

export function getPeachesConfig(guildId) {
  return db.select().from(peachesConfig).where(eq(peachesConfig.guildId, guildId)).get();
}

export function ensurePeachesConfig(guildId) {
  const existing = getPeachesConfig(guildId);
  if (existing) return existing;
  const row = {
    guildId,
    mischiefEnabled: 1,
    escalationEnabled: 1,
    mischiefFrequency: 'normal',
    crossMusic: 1,
    crossNews: 1,
    crossOutages: 1,
    crossHoards: 1,
    spawnChannels: null,
    quietHours: 1,
  };
  db.insert(peachesConfig).values(row).run();
  return row;
}

export function updatePeachesConfig(guildId, patch) {
  ensurePeachesConfig(guildId);
  db.update(peachesConfig).set(patch).where(eq(peachesConfig.guildId, guildId)).run();
  return getPeachesConfig(guildId);
}

export function getSpawnChannelIds(guildId) {
  const config = getPeachesConfig(guildId);
  return config?.spawnChannels ? config.spawnChannels.split(',').filter(Boolean) : [];
}

export function setSpawnChannelIds(guildId, channelIds) {
  updatePeachesConfig(guildId, { spawnChannels: channelIds.join(',') });
}

/** True if she should stay out of sight right now (overnight in the server's timezone, unless turned off). */
export function isSleepingNow(guildId, now = new Date()) {
  const config = ensurePeachesConfig(guildId);
  if (config.quietHours === 0) return false;
  return isQuietHours(now, getGuildConfig(guildId)?.timezone);
}

export function isCrossModuleEnabled(guildId, moduleKey) {
  const config = ensurePeachesConfig(guildId);
  const field = { music: 'crossMusic', news: 'crossNews', outages: 'crossOutages', hoards: 'crossHoards' }[moduleKey];
  return field ? Boolean(config[field]) : false;
}
