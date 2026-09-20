import { setup } from './commands/setup.js';
import { setupButtons, setupSelects, setupModals } from './handlers.js';
import { handleGuildCreate } from './welcome.js';

export default {
  name: 'setup',
  commands: [setup],
  buttons: setupButtons,
  selects: setupSelects,
  modals: setupModals,
  events: [{ name: 'guildCreate', execute: handleGuildCreate }],
  cron: [],
};
