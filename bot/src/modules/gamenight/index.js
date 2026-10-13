import { games, gameButtons, finishPoll } from './commands/games.js';
import { teams, teamButtons } from './commands/teams.js';
import { listExpiredPolls } from './store.js';
import { logger } from '../../core/logger.js';
import { dealTick, freeGameTick } from './deals.js';

async function sweepPolls(client) {
  for (const poll of listExpiredPolls()) {
    await finishPoll(client, poll.id).catch((err) => logger.warn({ err, pollId: poll.id }, 'Could not close game night vote'));
  }
}

export default {
  name: 'gamenight',
  commands: [games, teams],
  buttons: { ...gameButtons, ...teamButtons },
  selects: {},
  modals: {},
  events: [],
  // Backstop for the in-process timer, e.g. a vote that ended while the bot was restarting.
  cron: [
    { schedule: '* * * * *', name: 'pollSweep', task: (client) => sweepPolls(client) },
    { schedule: '17 */6 * * *', name: 'steamDeals', task: (client) => dealTick(client) },
    { schedule: '41 */3 * * *', name: 'epicFreeGames', task: (client) => freeGameTick(client) },
  ],
  init: async (client) => sweepPolls(client),
};
