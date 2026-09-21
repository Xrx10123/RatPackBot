import { stats, buildStatsPayload } from './commands/stats.js';
import { steamCommand, buildSteamPayload } from './commands/steam.js';
import { news, newsButtons } from './commands/news.js';
import { seedDefaultNewsSubscriptions } from './newsSeed.js';
import { pollAllNews } from './newsScheduler.js';

export default {
  name: 'games',
  commands: [stats, steamCommand, news],
  buttons: {
    ...newsButtons,
    async stats_refresh(interaction, game, ...usernameParts) {
      await interaction.deferUpdate();
      const username = usernameParts.join(':');
      await interaction.editReply(await buildStatsPayload(game, username));
    },
    async steam_refresh(interaction, ...inputParts) {
      await interaction.deferUpdate();
      const input = inputParts.join(':');
      await interaction.editReply(await buildSteamPayload(input));
    },
  },
  selects: {},
  modals: {},
  events: [
    {
      name: 'guildCreate',
      execute: async (client, guild) => seedDefaultNewsSubscriptions(guild.id),
    },
  ],
  cron: [{ schedule: '0 */6 * * *', name: 'newsPoll', task: (client) => pollAllNews(client) }],
};
