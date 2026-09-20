import { outage } from './commands/outage.js';
import { status } from './commands/status.js';
import { seedDefaultMonitors } from './seed.js';
import { pollAllOutages } from './checker.js';

export default {
  name: 'outages',
  commands: [outage, status],
  buttons: {},
  selects: {},
  modals: {},
  events: [
    {
      name: 'guildCreate',
      execute: async (client, guild) => seedDefaultMonitors(guild.id),
    },
  ],
  cron: [{ schedule: '*/5 * * * *', name: 'outagePoll', task: (client) => pollAllOutages(client) }],
};
