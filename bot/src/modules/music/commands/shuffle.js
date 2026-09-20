import { SlashCommandBuilder } from 'discord.js';
import { requirePlayerInVoice } from '../guards.js';
import { successEmbed, warnEmbed } from '../../../core/embeds.js';
import { flavor, FLAVOR } from '../../../utils/ratpack.js';

export const shuffle = {
  data: new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the current queue.'),

  async execute(interaction) {
    const { ok, player } = await requirePlayerInVoice(interaction);
    if (!ok) return;

    if (player.queue.tracks.length < 2) {
      await interaction.reply({ embeds: [warnEmbed({ description: '🐀 Not enough queued up to shuffle.' })], ephemeral: true });
      return;
    }

    await player.queue.shuffle();
    await interaction.reply({
      embeds: [successEmbed({ description: `🔀 Shuffled the hoard's queue. ${flavor(FLAVOR.shuffled)}`.trim() })],
      ephemeral: true,
    });
  },
};
