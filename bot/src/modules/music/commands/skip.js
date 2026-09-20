import { SlashCommandBuilder } from 'discord.js';
import { requirePlayerInVoice } from '../guards.js';
import { successEmbed, warnEmbed } from '../../../core/embeds.js';

export const skip = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current track.'),

  async execute(interaction) {
    const { ok, player } = await requirePlayerInVoice(interaction);
    if (!ok) return;

    const current = player.queue.current;
    if (!current) {
      await interaction.reply({ embeds: [warnEmbed({ description: "🐀 Nothing's playing." })], ephemeral: true });
      return;
    }

    await player.skip();
    await interaction.reply({ embeds: [successEmbed({ description: `⏭ Skipped **${current.info.title}**.` })], ephemeral: true });
  },
};
