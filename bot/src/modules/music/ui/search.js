import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { infoEmbed, successEmbed, errorEmbed } from '../../../core/embeds.js';
import { checkChannelPermissions } from '../../../core/permissions.js';
import { formatDuration } from '../../../utils/format.js';
import { ensureConnectedPlayer, markBridgeNotice, voiceConflictEmbed } from '../playerLifecycle.js';
import { componentText, escapeMarkdown } from '../../../utils/text.js';
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
        label: componentText(track.info.title, 'Untitled track'),
        description: componentText(`${track.info.author || 'Unknown artist'} · ${track.info.isStream ? 'LIVE' : formatDuration(track.info.duration)}`),
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
        title: componentText(track.info.title, 'Untitled track', 256),
        description: `${escapeMarkdown(track.info.author || 'Unknown artist')} · ${track.info.isStream ? 'LIVE' : formatDuration(track.info.duration)}`,
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
    if (!track) {
      await interaction.deferUpdate();
      return;
    }
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
    // Connecting to voice + starting playback can outlast the 3s window.
    await interaction.deferUpdate();
    const { player, conflictChannelId } = await ensureConnectedPlayer(interaction.guildId, voiceChannel);
    if (!player) {
      await interaction.editReply({ embeds: [voiceConflictEmbed(conflictChannelId)], components: [] });
      return;
    }
    markBridgeNotice(player, interaction.channelId);
    track.requester = interaction.user;
    if (player.queue.current) {
      // "Play Now" jumps the queue rather than throwing away what's playing:
      // the new track goes to the front, and the current one is skipped
      // (it stays reachable via ⏮ on the panel).
      await player.queue.add(track, 0);
      await player.skip();
    } else {
      await player.queue.add(track);
      await player.play();
    }

    cache.delete(cacheKey);
    await interaction.editReply({ embeds: [successEmbed({ description: `▶ Playing **${escapeMarkdown(track.info.title)}** now.` })], components: [] });
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
    await interaction.deferUpdate();
    const { player, conflictChannelId } = await ensureConnectedPlayer(interaction.guildId, voiceChannel);
    if (!player) {
      await interaction.editReply({ embeds: [voiceConflictEmbed(conflictChannelId)], components: [] });
      return;
    }
    markBridgeNotice(player, interaction.channelId);
    await player.queue.add(track);
    if (!player.playing && !player.paused) await player.play();

    cache.delete(cacheKey);
    await interaction.editReply({ embeds: [successEmbed({ description: `🐀 Queued **${escapeMarkdown(track.info.title)}**.` })], components: [] });
  },
};
