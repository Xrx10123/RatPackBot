import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { getLavalinkManager } from '../../../lavalink/manager.js';
import { successEmbed, infoEmbed, errorEmbed, warnEmbed } from '../../../core/embeds.js';
import { checkChannelPermissions } from '../../../core/permissions.js';
import { formatProgressBar } from '../../../utils/format.js';
import { listPublicHoards, getHoardById, getHoardTracks, resolveHoardTracks, ensureCommunityFavorites, isTrackInHoard, addTrackToHoard } from '../hoards.js';
import { getPanelRow, upsertPanelRow, deletePanelRow } from '../panelStore.js';
import { buildQueuePage } from './queuePage.js';
import { getGuildConfig } from '../../../core/guildConfig.js';
import { registerSkipVote } from '../voteSkip.js';

export const PANEL_REFRESH_MS = 10_000;
const LOOP_LABEL = { off: 'Off', track: 'Track', queue: 'Queue' };
const VOLUME_STEP = 10;

function formatRequester(requester) {
  if (!requester) return 'the rats';
  if (typeof requester === 'string') return requester; // e.g. Peaches' cross-module hook
  if (typeof requester === 'object' && 'id' in requester) return `<@${requester.id}>`;
  return 'the rats';
}

function nowPlayingEmbed(player) {
  const track = player.queue.current;
  const progress = track.info.isStream ? '🔴 LIVE' : formatProgressBar(player.position, track.info.duration);

  return successEmbed({
    title: '🎵 The Rat Nest',
    description: [
      `**[${track.info.title}](${track.info.uri})**`,
      track.info.author,
      '',
      progress,
      '',
      `🎧 ${track.info.sourceName ?? 'unknown'} · 🐀 requested by ${formatRequester(track.requester)} · 🔁 ${LOOP_LABEL[player.repeatMode]}`,
    ].join('\n'),
    thumbnail: track.info.artworkUrl ?? undefined,
  });
}

function idleEmbed() {
  return infoEmbed({ title: '🎵 The Rat Nest', description: '🐀 Nothing playing. Queue something with `/play` or `/search`.' });
}

function controlRows(player) {
  const track = player.queue.current;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music:panel_previous').setEmoji('⏮').setStyle(ButtonStyle.Secondary).setDisabled(player.queue.previous.length === 0),
    new ButtonBuilder().setCustomId('music:panel_pauseresume').setEmoji(player.paused ? '▶️' : '⏸️').setStyle(ButtonStyle.Primary).setDisabled(!track),
    new ButtonBuilder().setCustomId('music:panel_skip').setEmoji('⏭').setStyle(ButtonStyle.Secondary).setDisabled(!track),
    new ButtonBuilder().setCustomId('music:panel_stop').setEmoji('⏹').setStyle(ButtonStyle.Danger).setDisabled(!track && player.queue.tracks.length === 0),
    new ButtonBuilder().setCustomId('music:panel_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary).setDisabled(player.queue.tracks.length < 2),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music:panel_loop')
      .setEmoji('🔁')
      .setLabel(LOOP_LABEL[player.repeatMode])
      .setStyle(player.repeatMode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music:panel_seekback').setEmoji('⏪').setStyle(ButtonStyle.Secondary).setDisabled(!track || track.info.isStream),
    new ButtonBuilder().setCustomId('music:panel_seekforward').setEmoji('⏩').setStyle(ButtonStyle.Secondary).setDisabled(!track || track.info.isStream),
    new ButtonBuilder().setCustomId('music:panel_queue').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music:panel_clear').setEmoji('🗑').setStyle(ButtonStyle.Secondary).setDisabled(player.queue.tracks.length === 0),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music:panel_voldown').setEmoji('🔉').setStyle(ButtonStyle.Secondary).setDisabled(player.volume <= 0),
    new ButtonBuilder().setCustomId('music:panel_mute').setEmoji('🔇').setStyle(player.volume === 0 ? ButtonStyle.Danger : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music:panel_volup').setEmoji('🔊').setStyle(ButtonStyle.Secondary).setDisabled(player.volume >= 200),
    new ButtonBuilder().setCustomId('music:panel_favorite').setEmoji('❤️').setStyle(ButtonStyle.Secondary).setDisabled(!track),
  );

  const rows = [row1, row2, row3];

  if (player.queue.tracks.length > 0) {
    const options = player.queue.tracks.slice(0, 25).map((t, i) => ({
      label: t.info.title.slice(0, 100),
      description: t.info.author.slice(0, 100),
      value: String(i),
    }));
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('music:panel_queueselect').setPlaceholder('Jump to a track (skips ahead)...').addOptions(options),
      ),
    );
  }

  if (rows.length < 5) {
    const hoards = listPublicHoards(player.guildId, 25);
    if (hoards.length > 0) {
      rows.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('music:panel_hoardselect')
            .setPlaceholder('Load a hoard into the queue...')
            .addOptions(hoards.map((h) => ({ label: h.name.slice(0, 100), value: h.id }))),
        ),
      );
    }
  }

  return rows;
}

export function buildPanelPayload(player) {
  return {
    embeds: [player.queue.current ? nowPlayingEmbed(player) : idleEmbed()],
    components: controlRows(player),
  };
}

function startProgressLoop(client, player) {
  const existing = player.get('panelInterval');
  if (existing) clearInterval(existing);

  const interval = setInterval(async () => {
    if (!player.queue.current) return;
    await refreshPanelMessage(client, player);
  }, PANEL_REFRESH_MS);
  interval.unref?.();
  player.set('panelInterval', interval);
}

export function stopProgressLoop(player) {
  const existing = player.get('panelInterval');
  if (existing) clearInterval(existing);
}

async function refreshPanelMessage(client, player) {
  const row = getPanelRow(player.voiceChannelId);
  if (!row?.messageId) return null;

  const channel = await client.channels.fetch(player.voiceChannelId).catch(() => null);
  if (!channel) return null;

  const message = await channel.messages.fetch(row.messageId).catch(() => null);
  if (!message) return null;

  return message.edit(buildPanelPayload(player)).catch(() => null);
}

/**
 * Creates the panel if it doesn't exist yet, or edits it in place. Falls
 * back to #rat-nest if the bot can't post in the voice channel's chat, per
 * the design doc's behavior rules.
 */
export async function upsertPanel(client, player) {
  const edited = await refreshPanelMessage(client, player);
  if (edited) {
    startProgressLoop(client, player);
    return edited;
  }

  const channel = await client.channels.fetch(player.voiceChannelId).catch(() => null);
  if (!channel) return null;

  const permCheck = checkChannelPermissions(channel, ['SendMessages', 'EmbedLinks']);
  if (!permCheck.ok) {
    return null;
  }

  const message = await channel.send(buildPanelPayload(player)).catch(() => null);
  if (!message) return null;

  upsertPanelRow({ guildId: player.guildId, voiceChannelId: player.voiceChannelId, messageId: message.id });
  startProgressLoop(client, player);
  return message;
}

export async function teardownPanel(voiceChannelId) {
  deletePanelRow(voiceChannelId);
}

// --- Interaction handlers ---------------------------------------------------

function requirePlayer(interaction) {
  return getLavalinkManager().getPlayer(interaction.guildId);
}

async function requireSameVoice(interaction, player) {
  const memberChannelId = interaction.member.voice?.channelId;
  if (!player || memberChannelId !== player.voiceChannelId) {
    await interaction.reply({
      embeds: [errorEmbed({ description: `🐀 Join <#${player?.voiceChannelId ?? interaction.channelId}> to control playback.` })],
      ephemeral: true,
    });
    return false;
  }
  return true;
}

export const panelButtons = {
  async panel_previous(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    const prevTrack = await player.queue.shiftPrevious();
    if (!prevTrack) {
      await interaction.reply({ embeds: [warnEmbed({ description: '🐀 No previous track.' })], ephemeral: true });
      return;
    }

    await player.play({ clientTrack: prevTrack });
    await interaction.deferUpdate();
  },

  async panel_pauseresume(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    if (player.paused) await player.resume();
    else await player.pause();

    await interaction.update(buildPanelPayload(player));
  },

  async panel_skip(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    const guildConfig = getGuildConfig(interaction.guildId);
    const result = registerSkipVote(player, interaction.member, interaction.member.voice.channel, guildConfig);

    if (!result.skip) {
      await interaction.reply({ embeds: [infoEmbed({ description: `🗳 Vote to skip: **${result.votes}/${result.needed}** (of ${result.total} listening).` })], ephemeral: true });
      return;
    }

    await player.skip();
    await interaction.deferUpdate();
  },

  async panel_stop(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    await player.stopPlaying(true);
    await interaction.update(buildPanelPayload(player));
  },

  async panel_shuffle(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    await player.queue.shuffle();
    await interaction.update(buildPanelPayload(player));
  },

  async panel_loop(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    const next = { off: 'track', track: 'queue', queue: 'off' }[player.repeatMode];
    await player.setRepeatMode(next);
    await interaction.update(buildPanelPayload(player));
  },

  async panel_seekback(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    await player.seek(Math.max(0, player.position - 10_000));
    await interaction.update(buildPanelPayload(player));
  },

  async panel_seekforward(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    const track = player.queue.current;
    await player.seek(Math.min(track.info.duration, player.position + 10_000));
    await interaction.update(buildPanelPayload(player));
  },

  async panel_queue(interaction) {
    const player = requirePlayer(interaction);
    if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
      await interaction.reply({ embeds: [infoEmbed({ description: "🐀 Queue's empty." })], ephemeral: true });
      return;
    }
    await interaction.reply({ ...buildQueuePage(player, 0), ephemeral: true });
  },

  async panel_clear(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    player.queue.splice(0, player.queue.tracks.length);
    await interaction.update(buildPanelPayload(player));
  },

  async panel_voldown(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    await player.setVolume(Math.max(0, player.volume - VOLUME_STEP));
    await interaction.update(buildPanelPayload(player));
  },

  async panel_volup(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    await player.setVolume(Math.min(200, player.volume + VOLUME_STEP));
    await interaction.update(buildPanelPayload(player));
  },

  async panel_mute(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    if (player.volume === 0) {
      await player.setVolume(player.get('volumeBeforeMute') ?? 100);
    } else {
      player.set('volumeBeforeMute', player.volume);
      await player.setVolume(0);
    }
    await interaction.update(buildPanelPayload(player));
  },

  async panel_favorite(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    const track = player.queue.current;
    if (!track) {
      await interaction.reply({ embeds: [errorEmbed({ description: "🐀 Nothing's playing to favorite." })], ephemeral: true });
      return;
    }

    const hoard = ensureCommunityFavorites(interaction.guildId);
    if (isTrackInHoard(hoard.id, track.info.uri)) {
      await interaction.reply({ embeds: [infoEmbed({ description: `❤️ **${track.info.title}** is already in Community Favorites.` })], ephemeral: true });
      return;
    }

    addTrackToHoard(hoard.id, track);
    await interaction.reply({ embeds: [successEmbed({ description: `❤️ Added **${track.info.title}** to Community Favorites!` })], ephemeral: true });
  },
};

export const panelSelects = {
  async panel_queueselect(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    const index = Number(interaction.values[0]);
    if (!Number.isInteger(index) || index >= player.queue.tracks.length) {
      await interaction.deferUpdate();
      return;
    }

    player.queue.tracks.splice(0, index);
    await player.skip();
    await interaction.deferUpdate();
  },

  async panel_hoardselect(interaction) {
    const player = requirePlayer(interaction);
    if (!(await requireSameVoice(interaction, player))) return;

    const hoard = getHoardById(interaction.values[0]);
    if (!hoard) {
      await interaction.update(buildPanelPayload(player));
      return;
    }

    const rows = getHoardTracks(hoard.id);
    const tracks = await resolveHoardTracks(player, rows, interaction.user);
    if (tracks.length > 0) {
      player.queue.add(tracks);
      if (!player.playing && !player.paused) await player.play();
    }

    await interaction.update(buildPanelPayload(player));
  },
};
