import { SlashCommandBuilder } from 'discord.js';
import { requirePlayerInVoice } from '../guards.js';
import { successEmbed, warnEmbed } from '../../../core/embeds.js';

export const resume = {
  data: new SlashCommandBuilder().setName('resume').setDescription('Resume playback.'),

  async execute(interaction) {
    const { ok, player } = await requirePlayerInVoice(interaction);
    if (!ok) return;

    if (!player.paused) {
      await interaction.reply({ embeds: [warnEmbed({ description: '🐀 Already playing.' })], ephemeral: true });
      return;
    }

    await player.resume();
    await interaction.reply({ embeds: [successEmbed({ description: '▶ Resumed.' })], ephemeral: true });
  },
};
