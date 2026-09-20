import { SlashCommandBuilder } from 'discord.js';
import { requirePlayerInVoice } from '../guards.js';
import { successEmbed, warnEmbed } from '../../../core/embeds.js';

export const pause = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause playback.'),

  async execute(interaction) {
    const { ok, player } = await requirePlayerInVoice(interaction);
    if (!ok) return;

    if (player.paused) {
      await interaction.reply({ embeds: [warnEmbed({ description: "🐀 Already paused." })], ephemeral: true });
      return;
    }

    await player.pause();
    await interaction.reply({ embeds: [successEmbed({ description: '⏸ Paused.' })], ephemeral: true });
  },
};
