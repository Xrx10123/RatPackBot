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
  lavalinkManager.init({ id: client.user.id, username: client.user.username });
});

process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled rejection'));
process.on('uncaughtException', (err) => logger.error({ err }, 'Uncaught exception'));

await loadModules(client);
await client.login(config.discord.token);
