import { pet } from './commands/pet.js';
import { spawnButtons } from './handlers/spawnButtons.js';
import { mischiefButtons } from './handlers/mischiefButtons.js';
import { spawnTick } from './spawner.js';
import { mischiefTick } from './mischief.js';
import { registerCrossModuleHooks } from './crossModule.js';
import { getLavalinkManager } from '../../lavalink/manager.js';
import { eventButtons } from './handlers/eventButtons.js';
import { birthdayTick, ensureBirthday } from './birthday.js';

export default {
  name: 'peaches',
  commands: [pet],
  buttons: { ...spawnButtons, ...mischiefButtons, ...eventButtons },
  selects: {},
  modals: {},
  // Her birthday in each server is the day she joined it — record it right away.
  events: [{ name: 'guildCreate', execute: async (client, guild) => ensureBirthday(guild) }],
  cron: [
    { schedule: '*/15 * * * *', name: 'spawnTick', task: (client) => spawnTick(client) },
    { schedule: '*/10 * * * *', name: 'mischiefTick', task: (client) => mischiefTick(client) },
    { schedule: '7 * * * *', name: 'birthdayTick', task: (client) => birthdayTick(client) },
  ],
  init: async (client) => {
    registerCrossModuleHooks(client, getLavalinkManager());
    await birthdayTick(client); // records birthdays for servers she was already in
  },
};
