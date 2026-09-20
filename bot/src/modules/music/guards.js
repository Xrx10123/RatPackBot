import { getLavalinkManager } from '../../lavalink/manager.js';
import { errorEmbed } from '../../core/embeds.js';

/**
 * Shared precondition for playback-control commands: there must be an active
 * player, and the invoking member must be in the same voice channel as it.
 * On failure, replies ephemerally and returns { ok: false }.
 */
export async function requirePlayerInVoice(interaction) {
  const manager = getLavalinkManager();
  const player = manager.getPlayer(interaction.guildId);

  if (!player) {
    await interaction.reply({
      embeds: [errorEmbed({ description: "🐀 Nothing's playing right now." })],
      ephemeral: true,
    });
    return { ok: false };
  }

  const memberVoiceChannelId = interaction.member.voice?.channelId;
  if (!memberVoiceChannelId || memberVoiceChannelId !== player.voiceChannelId) {
    await interaction.reply({
      embeds: [errorEmbed({ description: `🐀 Join <#${player.voiceChannelId}> to control playback.` })],
      ephemeral: true,
    });
    return { ok: false };
  }

  return { ok: true, player };
}
