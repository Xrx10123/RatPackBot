import { SlashCommandBuilder } from 'discord.js';
import { requirePlayerInVoice } from '../guards.js';
import { successEmbed } from '../../../core/embeds.js';
import { flavor, FLAVOR } from '../../../utils/ratpack.js';

export const stop = {
  data: new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue.'),

  async execute(interaction) {
    const { ok, player } = await requirePlayerInVoice(interaction);
    if (!ok) return;

    await player.stopPlaying(true);
    await interaction.reply({
      embeds: [successEmbed({ description: `⏹ Stopped. ${flavor(FLAVOR.stopped) || "The hoard's queue is empty."}` })],
      ephemeral: true,
    });
  },
};
