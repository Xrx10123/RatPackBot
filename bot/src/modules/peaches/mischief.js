import { logger } from '../../core/logger.js';
import { ensurePeachesConfig, getSpawnChannelIds } from './config.js';
import { getCurrentState, getLeastRecentInteractors } from './state.js';
import {
  getActiveMischiefInChannel,
  createMischief,
  setMischiefMessageId,
  nextEscalationType,
  listUnresolvedForGuild,
  resolveMischief,
} from './mischiefStore.js';
import {
  buildTurdPayload,
  buildHolePayload,
  buildShredPayload,
  buildWallsPayload,
  buildRulerPayload,
  buildCrumbsPayload,
  buildGiftPayload,
  buildBitePayload,
} from './ui/mischiefEmbeds.js';
import { pickEmojiToSteal } from './crossModule.js';

const FREQ_MULTIPLIER = { low: 0.5, normal: 1, high: 1.75 };
const BASE_CHANCE = { thriving: 0.15, content: 0.08, restless: 0.2, grumpy: 0.3, neglected: 0.5 };
const MISCHIEF_TTL_MS = 90 * 60 * 1000; // "auto-expire after 1-2 hours" guardrail
const TURD_STALE_MS = 30 * 60 * 1000;
const BITE_CHANCE = 0.25; // occasional alternative to the escalation ladder while neglected

const CRUMBS_LINES = [
  (name) => `🧀 ${name} left you a snack. You're welcome.`,
  (name) => `🧀 ${name} dropped some crumbs on the way through. A gift, apparently.`,
  (name) => `🧀 ${name} generously donated a half-eaten cracker to the cause.`,
];

const BITE_LINES = [
  (name, mention) => `🐀 ${name} has had enough of being ignored. She bites ${mention}.`,
  (name, mention) => `🐀 ${name} sinks her teeth into ${mention}. That's what you get for staying away so long.`,
  (name, mention) => `🐀 Out of nowhere, ${name} bites ${mention}. Maybe visit more often?`,
];

async function triggerAmbientMischief(client, channel, guildId, state) {
  if (state.mood === 'thriving') {
    const row = createMischief({ guildId, channelId: channel.id, type: 'crumbs', expiresInMs: MISCHIEF_TTL_MS });
    const line = CRUMBS_LINES[Math.floor(Math.random() * CRUMBS_LINES.length)](state.name);
    const payload = await buildCrumbsPayload(state.name, row.id, line);
    const message = await channel.send(payload).catch(() => null);
    if (message) setMischiefMessageId(row.id, message.id);
    return;
  }

  // content
  const row = createMischief({ guildId, channelId: channel.id, type: 'gift', expiresInMs: MISCHIEF_TTL_MS });
  const payload = await buildGiftPayload(state.name, row.id);
  const message = await channel.send(payload).catch(() => null);
  if (message) setMischiefMessageId(row.id, message.id);
}

async function triggerInteractiveMischief(client, channel, guildId, state, type) {
  const ttl = type === 'turd' ? TURD_STALE_MS * 2 : MISCHIEF_TTL_MS;
  const row = createMischief({ guildId, channelId: channel.id, type, expiresInMs: ttl });
  const payload = await (type === 'turd' ? buildTurdPayload(state.name, row.id) : buildHolePayload(state.name, row.id));
  const message = await channel.send(payload).catch(() => null);
  if (message) setMischiefMessageId(row.id, message.id);
}

const ESCALATION_BUILDERS = {
  hole_extra: buildHolePayload,
  shred: buildShredPayload,
  walls: buildWallsPayload,
  ruler: buildRulerPayload,
};

async function triggerEscalation(client, channel, guildId, state) {
  const type = nextEscalationType(guildId);
  const row = createMischief({ guildId, channelId: channel.id, type, expiresInMs: MISCHIEF_TTL_MS });
  const payload = await ESCALATION_BUILDERS[type](state.name, row.id);

  // Emoji Thief — flavor text only, no cross-module config field of its own,
  // piggybacks on escalationEnabled since it only ever fires during neglect.
  const stolen = pickEmojiToSteal(channel.guild);
  if (stolen) {
    payload.content = `${state.name} eyes ${stolen} suspiciously and makes off with it. (Don't worry, it still works.)`;
  }

  const message = await channel.send(payload).catch(() => null);
  if (message) setMischiefMessageId(row.id, message.id);
}

/**
 * Occasional alternative to the escalation ladder while neglected: bites a
 * random pick from whoever's interacted least recently (not just anyone —
 * someone who's actually engaged before). Ambient like crumbs/gift, but
 * still resolved immediately — the "Ouch!" button below is a non-exclusive
 * reaction (anyone can click it), not a first-click-wins resolution.
 */
async function triggerBite(client, channel, guildId, state) {
  const candidates = getLeastRecentInteractors(guildId, 5);
  if (candidates.length === 0) return false;

  const targetId = candidates[Math.floor(Math.random() * candidates.length)];
  const row = createMischief({ guildId, channelId: channel.id, type: 'bite', expiresInMs: MISCHIEF_TTL_MS });
  resolveMischief(row.id);

  const line = BITE_LINES[Math.floor(Math.random() * BITE_LINES.length)](state.name, `<@${targetId}>`);
  const payload = await buildBitePayload(state.name, `<@${targetId}>`, line);
  await channel.send(payload).catch(() => {});
  return true;
}

async function tryMischiefForGuild(client, guildId) {
  const config = ensurePeachesConfig(guildId);
  if (!config.mischiefEnabled) return;

  const spawnChannels = getSpawnChannelIds(guildId);
  if (spawnChannels.length === 0) return;

  const state = getCurrentState(guildId);
  const isEscalation = state.mood === 'neglected';
  if (isEscalation && !config.escalationEnabled) return;

  const chance = (BASE_CHANCE[state.mood] ?? 0.1) * (FREQ_MULTIPLIER[config.mischiefFrequency] ?? 1);
  if (Math.random() > chance) return;

  const eligible = spawnChannels.filter((id) => !getActiveMischiefInChannel(id));
  if (eligible.length === 0) return;

  const channelId = eligible[Math.floor(Math.random() * eligible.length)];
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  if (isEscalation) {
    if (Math.random() < BITE_CHANCE && (await triggerBite(client, channel, guildId, state))) return;
    await triggerEscalation(client, channel, guildId, state);
  } else if (state.mood === 'restless') {
    await triggerInteractiveMischief(client, channel, guildId, state, 'turd');
  } else if (state.mood === 'grumpy') {
    await triggerInteractiveMischief(client, channel, guildId, state, 'hole');
  } else {
    await triggerAmbientMischief(client, channel, guildId, state);
  }
}

async function sweepGuildMischief(client, guildId) {
  const now = Date.now();
  for (const row of listUnresolvedForGuild(guildId)) {
    if (now > row.expiresAt) {
      resolveMischief(row.id);
      if (row.messageId) {
        const channel = await client.channels.fetch(row.channelId).catch(() => null);
        const message = channel && (await channel.messages.fetch(row.messageId).catch(() => null));
        await message?.edit({ components: [] }).catch(() => {});
      }
      continue;
    }

    if (row.type === 'turd' && now - row.spawnedAt > TURD_STALE_MS && row.messageId) {
      const channel = await client.channels.fetch(row.channelId).catch(() => null);
      const message = channel && (await channel.messages.fetch(row.messageId).catch(() => null));
      const state = getCurrentState(guildId);
      const stalePayload = await buildTurdPayload(state.name, row.id, { stale: true });
      await message?.edit(stalePayload).catch(() => {});
    }
  }
}

export async function mischiefTick(client) {
  for (const guild of client.guilds.cache.values()) {
    await sweepGuildMischief(client, guild.id).catch((err) => logger.warn({ err, guildId: guild.id }, 'Peaches mischief sweep failed'));
    await tryMischiefForGuild(client, guild.id).catch((err) => logger.warn({ err, guildId: guild.id }, 'Peaches mischief roll failed'));
  }
}
