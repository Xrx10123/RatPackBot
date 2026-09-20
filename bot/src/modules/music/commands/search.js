import { SlashCommandBuilder } from 'discord.js';
import { getLavalinkManager } from '../../../lavalink/manager.js';
import { errorEmbed, warnEmbed } from '../../../core/embeds.js';
import { runSearch, buildSearchResultsPayload } from '../ui/search.js';

export const search = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for a track and pick from the results.')
    .addStringOption((opt) => opt.setName('query').setDescription('Search term').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const query = interaction.options.getString('query', true);
    const manager = getLavalinkManager();
    const node = manager.nodeManager.leastUsedNodes()[0];
    if (!node) {
      await interaction.editReply({ embeds: [errorEmbed({ description: "🐀 Lavalink isn't connected right now." })] });
      return;
    }

    const found = await runSearch(node, query, interaction.user);
    if (!found) {
      await interaction.editReply({ embeds: [warnEmbed({ description: '🐀 Nothing turned up for that.' })] });
      return;
    }

    await interaction.editReply(buildSearchResultsPayload(found.cacheKey, found.tracks));
  },
};
