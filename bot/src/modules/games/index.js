import { stats } from './commands/stats.js';
import { steamCommand } from './commands/steam.js';
import { news, newsButtons } from './commands/news.js';
import { seedDefaultNewsSubscriptions } from './newsSeed.js';
import { pollAllNews } from './newsScheduler.js';

export default {
  name: 'games',
  commands: [stats, steamCommand, news],
  buttons: { ...newsButtons },
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
