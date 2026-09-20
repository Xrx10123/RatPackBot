import { config } from './config.js';
import './db/index.js'; // running this module applies pending migrations
import { logger } from './core/logger.js';
import { createClient } from './core/client.js';
import { loadModules } from './core/moduleLoader.js';
import { createLavalinkManager } from './lavalink/manager.js';
import { registerLavalinkEvents } from './lavalink/events.js';

const client = createClient();

const lavalinkManager = createLavalinkManager(client);
registerLavalinkEvents(lavalinkManager, client);

client.once('ready', () => {
  logger.info({ tag: client.user.tag }, '🐀 Ratpack is online');
  lavalinkManager.init({ id: client.user.id, username: client.user.username }).catch((err) => logger.error({ err }, 'Lavalink manager init failed'));
});

// After an uncaught exception the process is in an undefined state — log and
// exit so Docker's `restart: unless-stopped` can cleanly retry, rather than
// silently continuing as a zombie that never finished starting up (this is
// exactly what happened during testing: a bad-token registration failure
// was swallowed here and the bot sat "Up" forever without ever calling
// client.login()).
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled rejection — exiting');
  process.exit(1);
});

await loadModules(client);
await client.login(config.discord.token);
