import { SlashCommandBuilder } from 'discord.js';
import { requirePlayerInVoice } from '../guards.js';
import { successEmbed, errorEmbed, warnEmbed } from '../../../core/embeds.js';
import { parseDuration, formatDuration } from '../../../utils/format.js';

export const seek = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Jump to a timestamp in the current track.')
    .addStringOption((opt) => opt.setName('time').setDescription('e.g. 90 or 1:30').setRequired(true)),

  async execute(interaction) {
    const { ok, player } = await requirePlayerInVoice(interaction);
    if (!ok) return;

    const current = player.queue.current;
    if (!current) {
      await interaction.reply({ embeds: [warnEmbed({ description: "🐀 Nothing's playing." })], ephemeral: true });
      return;
    }
    if (current.info.isStream) {
      await interaction.reply({ embeds: [errorEmbed({ description: "🐀 Can't seek a live stream." })], ephemeral: true });
      return;
    }

    const raw = interaction.options.getString('time', true);
    const ms = parseDuration(raw);
    if (ms === null || ms > current.info.duration) {
      await interaction.reply({
        embeds: [errorEmbed({ description: `🐀 That's not a valid timestamp for a track that's ${formatDuration(current.info.duration)} long.` })],
        ephemeral: true,
      });
      return;
    }

    await player.seek(ms);
    await interaction.reply({ embeds: [successEmbed({ description: `⏩ Jumped to **${formatDuration(ms)}**.` })], ephemeral: true });
  },
};
