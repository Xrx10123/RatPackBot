import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { hoards, hoardTracks } from '../../db/schema.js';
import { getGuildConfig } from '../../core/guildConfig.js';
import { logger } from '../../core/logger.js';
import { isCrossModuleEnabled } from './config.js';
import { getCurrentState } from './state.js';

/**
 * Hooks into shared infrastructure (discord.js client events, the Lavalink
 * manager, and the shared DB schema — all core/ level, not any module's
 * internals) rather than importing from modules/music, modules/games, or
 * modules/outages directly, per "adding a module never touches another
 * module's code." News/outage detection works by watching the bot's own
 * messages in the guild's configured channels rather than the source
 * modules calling into Peaches.
 */
const RATE_LIMIT_MS = 10 * 60 * 1000;
const lastFired = new Map(); // `${guildId}:${hook}` -> timestamp

function canFire(guildId, hook, chance) {
  const key = `${guildId}:${hook}`;
  if (Date.now() - (lastFired.get(key) ?? 0) < RATE_LIMIT_MS) return false;
  if (Math.random() > chance) return false;
  lastFired.set(key, Date.now());
  return true;
}

const PEACHES_HOARD_NAME = "Peaches' Hoard";

export function ensurePeachesHoard(guildId, name) {
  const existing = db.select().from(hoards).where(and(eq(hoards.guildId, guildId), eq(hoards.name, PEACHES_HOARD_NAME))).get();
  if (existing) return existing;
  const row = { id: randomUUID(), guildId, ownerId: `peaches:${guildId}`, name: PEACHES_HOARD_NAME, isPublic: 1, createdAt: Date.now() };
  db.insert(hoards).values(row).run();
  return row;
}

function getPeachesHoardTracks(guildId) {
  const hoard = db.select().from(hoards).where(and(eq(hoards.guildId, guildId), eq(hoards.name, PEACHES_HOARD_NAME))).get();
  if (!hoard) return [];
  return db.select().from(hoardTracks).where(eq(hoardTracks.hoardId, hoard.id)).all();
}

function addToPeachesHoard(guildId, track) {
  const hoard = ensurePeachesHoard(guildId, PEACHES_HOARD_NAME);
  const count = db.select().from(hoardTracks).where(eq(hoardTracks.hoardId, hoard.id)).all().length;
  db.insert(hoardTracks).values({
    id: randomUUID(),
    hoardId: hoard.id,
    position: count,
    title: track.info.title,
    artist: track.info.author,
    uri: track.info.uri,
    duration: track.info.duration,
    source: track.info.sourceName ?? null,
  }).run();
}

export function registerCrossModuleHooks(client, lavalinkManager) {
  // Music: curates "Peaches' Hoard" from what's playing, and occasionally
  // queues something back from it with requester "Peaches 🐀".
  lavalinkManager.on('trackStart', async (player, track) => {
    try {
      const guildId = player.guildId;
      if (!track || !isCrossModuleEnabled(guildId, 'hoards')) return;
      if (canFire(guildId, 'hoards-curate', 0.15)) addToPeachesHoard(guildId, track);

      if (!isCrossModuleEnabled(guildId, 'music')) return;
      if (!canFire(guildId, 'music', 0.05)) return;

      const candidates = getPeachesHoardTracks(guildId).filter((t) => t.uri);
      if (candidates.length === 0) return;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];

      const result = await player.search({ query: pick.uri }, 'Peaches 🐀').catch(() => null);
      const resolved = result?.tracks?.[0];
      if (resolved) player.queue.add(resolved);
    } catch (err) {
      logger.warn({ err }, 'Peaches music cross-hook failed');
    }
  });

  // News + Outages: react to the bot's own posts in those configured channels.
  client.on('messageCreate', async (message) => {
    try {
      if (!message.guild || message.author.id !== client.user.id) return;
      const guildConfig = getGuildConfig(message.guild.id);
      const state = getCurrentState(message.guild.id);

      if (guildConfig?.newsChannelId && message.channelId === guildConfig.newsChannelId) {
        if (!isCrossModuleEnabled(message.guild.id, 'news') || !canFire(message.guild.id, 'news', 0.2)) return;
        await message.reply({ content: `🐀 ${state.name} has also seen this. She is unimpressed.` }).catch(() => {});
        return;
      }

      const recovered = message.embeds[0]?.description?.includes('crawled back online');
      if (guildConfig?.outageChannelId && message.channelId === guildConfig.outageChannelId && recovered) {
        if (!isCrossModuleEnabled(message.guild.id, 'outages') || !canFire(message.guild.id, 'outages', 0.3)) return;
        await message.reply({ content: '🐀 The rats have restored order.' }).catch(() => {});
      }
    } catch (err) {
      logger.warn({ err }, 'Peaches news/outage cross-hook failed');
    }
  });
}

/** Emoji Thief — flavor text only, the emoji itself is untouched and still usable. */
export function pickEmojiToSteal(guild) {
  const emojis = [...guild.emojis.cache.values()];
  if (emojis.length === 0) return null;
  return emojis[Math.floor(Math.random() * emojis.length)];
}
