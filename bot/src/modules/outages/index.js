import { outage } from './commands/outage.js';
import { status } from './commands/status.js';
import { server, buildServerCheckPayload } from './commands/server.js';
import { seedDefaultMonitors } from './seed.js';
import { pollAllOutages } from './checker.js';
import { refreshStatusBoard } from './ui/board.js';

export default {
  name: 'outages',
  commands: [outage, status, server],
  buttons: {
    async board_refresh(interaction) {
      await interaction.deferUpdate();
      const payload = await refreshStatusBoard(interaction.guildId);
      await interaction.editReply(payload);
    },
    async server_refresh(interaction, slug) {
      await interaction.deferUpdate();
      const payload = await buildServerCheckPayload(slug);
      await interaction.editReply(payload);
    },
  },
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
