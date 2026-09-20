import { pet } from './commands/pet.js';
import { spawnButtons } from './handlers/spawnButtons.js';
import { mischiefButtons } from './handlers/mischiefButtons.js';
import { spawnTick } from './spawner.js';
import { mischiefTick } from './mischief.js';
import { registerCrossModuleHooks } from './crossModule.js';
import { getLavalinkManager } from '../../lavalink/manager.js';

export default {
  name: 'peaches',
  commands: [pet],
  buttons: { ...spawnButtons, ...mischiefButtons },
  selects: {},
  modals: {},
  events: [],
  cron: [
    { schedule: '*/15 * * * *', name: 'spawnTick', task: (client) => spawnTick(client) },
    { schedule: '*/10 * * * *', name: 'mischiefTick', task: (client) => mischiefTick(client) },
  ],
  init: async (client) => {
    registerCrossModuleHooks(client, getLavalinkManager());
  },
};
