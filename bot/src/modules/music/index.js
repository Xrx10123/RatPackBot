import { play } from './commands/play.js';
import { search } from './commands/search.js';
import { queue } from './commands/queue.js';
import { skip } from './commands/skip.js';
import { pause } from './commands/pause.js';
import { resume } from './commands/resume.js';
import { stop } from './commands/stop.js';
import { volume } from './commands/volume.js';
import { loop } from './commands/loop.js';
import { shuffle } from './commands/shuffle.js';
import { seek } from './commands/seek.js';
import { playlist } from './commands/playlist.js';
import { searchHandlers } from './ui/search.js';
import { panelButtons, panelSelects, upsertPanel } from './ui/panel.js';
import { getPanelRowByMessageId, deletePanelRow } from './panelStore.js';
import { getLavalinkManager } from '../../lavalink/manager.js';
import { buildQueuePage } from './ui/queuePage.js';

export default {
  name: 'music',
  commands: [play, search, queue, skip, pause, resume, stop, volume, loop, shuffle, seek, playlist],
  buttons: {
    ...panelButtons,
    search_playnow: searchHandlers.search_playnow,
    search_addqueue: searchHandlers.search_addqueue,
    async 'queue_page'(interaction, pageStr) {
      const manager = getLavalinkManager();
      const player = manager.getPlayer(interaction.guildId);
      if (!player) {
        await interaction.deferUpdate();
        return;
      }
      await interaction.update(buildQueuePage(player, Number(pageStr)));
    },
  },
  selects: {
    ...panelSelects,
    search_select: searchHandlers.search_select,
  },
  modals: {},
  events: [
    {
      name: 'messageDelete',
      execute: async (client, message) => {
        const row = getPanelRowByMessageId(message.id);
        if (!row) return;

        const manager = getLavalinkManager();
        const player = manager.getPlayer(row.guildId);
        if (!player) {
          deletePanelRow(row.voiceChannelId);
          return;
        }

        await upsertPanel(client, player);
      },
    },
  ],
  cron: [],
};
