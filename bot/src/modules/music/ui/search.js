import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { infoEmbed, successEmbed, errorEmbed } from '../../../core/embeds.js';
import { checkChannelPermissions } from '../../../core/permissions.js';
import { formatDuration } from '../../../utils/format.js';
import { ensureConnectedPlayer, markBridgeNotice } from '../playerLifecycle.js';
import { isUrl } from '../sources.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // cacheKey -> { tracks: Track[] }

function remember(tracks) {
  const key = randomUUID().slice(0, 8);
  cache.set(key, { tracks });
  setTimeout(() => cache.delete(key), CACHE_TTL_MS).unref?.();
  return key;
}

export function buildSearchResultsPayload(cacheKey, tracks) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`music:search_select:${cacheKey}`)
    .setPlaceholder('Pick a track...')
    .addOptions(
      tracks.slice(0, 10).map((track, i) => ({
        label: track.info.title.slice(0, 100),
        description: `${track.info.author} · ${track.info.isStream ? 'LIVE' : formatDuration(track.info.duration)}`.slice(0, 100),
        value: String(i),
      })),
    );

  return {
    embeds: [infoEmbed({ title: '🔍 Search results', description: 'Pick one below.' })],
    components: [new ActionRowBuilder().addComponents(select)],
  };
}

function buildTrackActionPayload(cacheKey, index, track) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`music:search_playnow:${cacheKey}:${index}`).setLabel('Play Now').setEmoji('▶️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`music:search_addqueue:${cacheKey}:${index}`).setLabel('Add to Queue').setEmoji('➕').setStyle(ButtonStyle.Secondary),
  );

  return {
    embeds: [
      infoEmbed({
        title: track.info.title,
        description: `${track.info.author} · ${track.info.isStream ? 'LIVE' : formatDuration(track.info.duration)}`,
        thumbnail: track.info.artworkUrl ?? undefined,
      }),
    ],
    components: [row],
  };
}

export async function runSearch(node, query, requester) {
  const result = await node.search({ query: isUrl(query) ? query : `ytsearch:${query}` }, requester);
  const tracks = result?.tracks ?? [];
  if (tracks.length === 0) return null;
  return { cacheKey: remember(tracks), tracks };
}

async function requireVoiceChannel(interaction) {
  const voiceChannel = interaction.member.voice?.channel;
  if (!voiceChannel) {
    await interaction.reply({ embeds: [errorEmbed({ description: '🐀 Hop into a voice channel first.' })], ephemeral: true });
    return null;
  }
  const permCheck = checkChannelPermissions(voiceChannel, ['Connect', 'Speak']);
  if (!permCheck.ok) {
    await interaction.reply({ embeds: [permCheck.embed], ephemeral: true });
    return null;
  }
  return voiceChannel;
}

export const searchHandlers = {
  async search_select(interaction, cacheKey) {
    const entry = cache.get(cacheKey);
    if (!entry) {
      await interaction.update({ embeds: [errorEmbed({ description: '🐀 That search expired — run `/search` again.' })], components: [] });
      return;
    }
    const index = Number(interaction.values[0]);
    const track = entry.tracks[index];
    await interaction.update(buildTrackActionPayload(cacheKey, index, track));
  },

  async search_playnow(interaction, cacheKey, indexStr) {
    const entry = cache.get(cacheKey);
    if (!entry) {
      await interaction.update({ embeds: [errorEmbed({ description: '🐀 That search expired — run `/search` again.' })], components: [] });
      return;
    }
    const voiceChannel = await requireVoiceChannel(interaction);
    if (!voiceChannel) return;

    const track = entry.tracks[Number(indexStr)];
    const player = await ensureConnectedPlayer(interaction.guildId, voiceChannel);
    markBridgeNotice(player, interaction.channelId);
    await player.play({ clientTrack: { ...track, requester: interaction.user } });

    cache.delete(cacheKey);
    await interaction.update({ embeds: [successEmbed({ description: `▶ Playing **${track.info.title}** now.` })], components: [] });
  },

  async search_addqueue(interaction, cacheKey, indexStr) {
    const entry = cache.get(cacheKey);
    if (!entry) {
      await interaction.update({ embeds: [errorEmbed({ description: '🐀 That search expired — run `/search` again.' })], components: [] });
      return;
    }
    const voiceChannel = await requireVoiceChannel(interaction);
    if (!voiceChannel) return;

    const track = entry.tracks[Number(indexStr)];
    const player = await ensureConnectedPlayer(interaction.guildId, voiceChannel);
    markBridgeNotice(player, interaction.channelId);
    player.queue.add(track);
    if (!player.playing && !player.paused) await player.play();

    cache.delete(cacheKey);
    await interaction.update({ embeds: [successEmbed({ description: `🐀 Queued **${track.info.title}**.` })], components: [] });
  },
};
