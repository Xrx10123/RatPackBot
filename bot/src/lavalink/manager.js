import { LavalinkManager } from 'lavalink-client';
import { config } from '../config.js';
import { logger } from '../core/logger.js';

let manager;

/** Creates and attaches the LavalinkManager to the discord.js client's raw gateway events. */
export function createLavalinkManager(client) {
  manager = new LavalinkManager({
    nodes: [
      {
        id: 'main',
        host: config.lavalink.host,
        port: config.lavalink.port,
        authorization: config.lavalink.password,
      },
    ],
    sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard?.send(payload),
    client: {
      id: config.discord.clientId,
    },
    autoSkip: true,
  });

  manager.nodeManager.on('connect', (node) => logger.info({ node: node.id }, 'Lavalink node connected'));
  manager.nodeManager.on('disconnect', (node, reason) =>
    logger.warn({ node: node.id, reason }, 'Lavalink node disconnected'),
  );
  manager.nodeManager.on('error', (node, error) => logger.error({ err: error, node: node.id }, 'Lavalink node error'));

  client.on('raw', (packet) => manager.sendRawData(packet));

  return manager;
}

export function getLavalinkManager() {
  if (!manager) throw new Error('Lavalink manager accessed before initialization');
  return manager;
}
