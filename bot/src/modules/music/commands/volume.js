import { SlashCommandBuilder } from 'discord.js';
import { requirePlayerInVoice } from '../guards.js';
import { successEmbed } from '../../../core/embeds.js';

export const volume = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the playback volume.')
    .addIntegerOption((opt) =>
      opt.setName('level').setDescription('0-200').setRequired(true).setMinValue(0).setMaxValue(200),
    ),

  async execute(interaction) {
    const { ok, player } = await requirePlayerInVoice(interaction);
    if (!ok) return;

    const level = interaction.options.getInteger('level', true);
    await player.setVolume(level);
    await interaction.reply({ embeds: [successEmbed({ description: `🔊 Volume set to **${level}%**.` })], ephemeral: true });
  },
};
