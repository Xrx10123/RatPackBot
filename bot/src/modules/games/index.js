import { stats, buildStatsPayload } from './commands/stats.js';
import { steamCommand, buildSteamPayload } from './commands/steam.js';
import { news, newsButtons } from './commands/news.js';
import { seedDefaultNewsSubscriptions } from './newsSeed.js';
import { pollAllNews } from './newsScheduler.js';
import * as steam from './providers/steam.js';
import { logger } from '../../core/logger.js';

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
  // The Steam catalog is ~150k entries across several pages — far too slow
  // to fetch inside a 3-second autocomplete, so the first /news add after a
  // restart used to show no suggestions. Warm it in the background instead.
  init: async () => {
    if (!steam.isAppListConfigured()) return;
    const apps = await steam.getAppList().catch((err) => logger.warn({ err }, 'Could not pre-load the Steam app list'));
    if (apps) logger.info({ apps: apps.length }, 'Steam app list cached');
  },
};
