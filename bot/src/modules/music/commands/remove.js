import { SlashCommandBuilder } from 'discord.js';
import { requirePlayerInVoice } from '../guards.js';
import { successEmbed, errorEmbed } from '../../../core/embeds.js';
import { getGuildConfig } from '../../../core/guildConfig.js';
import { isDJ } from '../voteSkip.js';
import { refreshPanel } from '../ui/panel.js';
import { queuePositionChoices } from '../ui/queueChoices.js';
import { escapeMarkdown } from '../../../utils/text.js';

/** Your own requests are yours to pull; anyone else's needs the DJ role (or it'd sidestep vote-skip). */
function canRemove(member, track, guildConfig) {
  return track.requester?.id === member.id || isDJ(member, guildConfig);
}

export const remove = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue.')
    .addIntegerOption((opt) => opt.setName('position').setDescription('Queue position (see /queue)').setRequired(true).setMinValue(1).setAutocomplete(true)),

  autocomplete: queuePositionChoices,

  async execute(interaction) {
    const { ok, player } = await requirePlayerInVoice(interaction);
    if (!ok) return;

    const position = interaction.options.getInteger('position', true);
    const track = player.queue.tracks[position - 1];
    if (!track) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 There's no track #${position} — the queue has ${player.queue.tracks.length}.` })], ephemeral: true });
      return;
    }

    if (!canRemove(interaction.member, track, getGuildConfig(interaction.guildId))) {
      await interaction.reply({ embeds: [errorEmbed({ description: "🐀 That's someone else's pick — only they or a DJ can pull it. Try `/skip` voting when it comes up." })], ephemeral: true });
      return;
    }

    await player.queue.remove(position - 1);
    await interaction.reply({ embeds: [successEmbed({ description: `🗑 Removed **${escapeMarkdown(track.info.title)}** from the queue.` })], ephemeral: true });
    await refreshPanel(interaction.client, player);
  },
};
