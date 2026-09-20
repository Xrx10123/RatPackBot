import { SlashCommandBuilder } from 'discord.js';
import { getLavalinkManager } from '../../../lavalink/manager.js';
import { infoEmbed } from '../../../core/embeds.js';
import { buildQueuePage } from '../ui/queuePage.js';
import { flavor, FLAVOR } from '../../../utils/ratpack.js';

export const queue = {
  data: new SlashCommandBuilder().setName('queue').setDescription("Show the hoard's queue."),

  async execute(interaction) {
    const manager = getLavalinkManager();
    const player = manager.getPlayer(interaction.guildId);

    if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
      await interaction.reply({ embeds: [infoEmbed({ description: `🐀 ${flavor(FLAVOR.queueEmpty) || "Queue's empty."}` })] });
      return;
    }

    await interaction.reply(buildQueuePage(player, 0));
  },
};
