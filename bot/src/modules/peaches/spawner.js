import { logger } from '../../core/logger.js';
import { getSpawnChannelIds } from './config.js';
import { ensureState, getCurrentState, bumpLastSpawnAt } from './state.js';
import { getActiveSpawn, createSpawn, pickVariant, setSpawnMessageId, resolveSpawn } from './spawns.js';
import { buildSpawnPayload } from './ui/spawnEmbed.js';
import { VARIANTS } from './variants.js';

const MIN_HOURS = 4;
const MAX_HOURS = 8;

/**
 * node-cron can't express "randomly every 4-8h" directly, so this ticks
 * every 15 minutes (via the module's cron entry) and rolls dice with rising
 * probability once MIN_HOURS has elapsed, reaching ~100% by MAX_HOURS —
 * an organic spread across the window without a dedicated "next spawn due"
 * column.
 */
async function maybeSpawnForGuild(client, guildId) {
  const spawnChannels = getSpawnChannelIds(guildId);
  if (spawnChannels.length === 0) return;

  const active = getActiveSpawn(guildId);
  if (active) {
    if (Date.now() > active.expiresAt) await expireSpawn(client, active);
    return;
  }

  const state = ensureState(guildId);
  const hoursSince = state.lastSpawnAt ? (Date.now() - state.lastSpawnAt) / (1000 * 60 * 60) : Infinity;
  if (hoursSince < MIN_HOURS) return;

  const chance = Math.min(1, (hoursSince - MIN_HOURS) / (MAX_HOURS - MIN_HOURS));
  if (Math.random() > chance) return;

  const channelId = spawnChannels[Math.floor(Math.random() * spawnChannels.length)];
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const variant = pickVariant();
  const spawn = createSpawn({ guildId, channelId, variant, expiresInMs: VARIANTS[variant].expiresInMs });
  bumpLastSpawnAt(guildId);

  const currentState = getCurrentState(guildId);
  const message = await channel.send(buildSpawnPayload(currentState, spawn)).catch(() => null);
  if (message) setSpawnMessageId(spawn.id, message.id);
}

async function expireSpawn(client, spawn) {
  resolveSpawn(spawn.id);
  if (!spawn.messageId) return;

  const channel = await client.channels.fetch(spawn.channelId).catch(() => null);
  const message = channel && (await channel.messages.fetch(spawn.messageId).catch(() => null));
  await message?.edit({ components: [] }).catch(() => {});
}

export async function spawnTick(client) {
  for (const guild of client.guilds.cache.values()) {
    await maybeSpawnForGuild(client, guild.id).catch((err) => logger.warn({ err, guildId: guild.id }, 'Peaches spawn tick failed'));
  }
}
