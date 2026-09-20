import { LavalinkManager } from 'lavalink-client';
import { config } from '../config.js';
import { logger } from '../core/logger.js';
import { readSavedSessionId, saveSessionId } from './session.js';

const RESUME_TIMEOUT_SECONDS = 300;

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
        sessionId: readSavedSessionId() ?? undefined,
      },
    ],
    sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard?.send(payload),
    client: {
      id: config.discord.clientId,
    },
    autoSkip: true,
  });

  manager.nodeManager.on('connect', async (node) => {
    logger.info({ node: node.id }, 'Lavalink node connected');
    try {
      await node.updateSession(true, RESUME_TIMEOUT_SECONDS);
      if (node.sessionId) saveSessionId(node.sessionId);
    } catch (err) {
      logger.warn({ err, node: node.id }, 'Could not enable Lavalink session resuming');
    }
  });
  manager.nodeManager.on('disconnect', (node, reason) =>
    logger.warn({ node: node.id, reason }, 'Lavalink node disconnected'),
  );
  manager.nodeManager.on('error', (node, error) => logger.error({ err: error, node: node.id }, 'Lavalink node error'));
  manager.nodeManager.on('resumed', (node, payload, players) => {
    const count = Array.isArray(players) ? players.length : 0;
    logger.info(
      { node: node.id, recoveredPlayers: count },
      count > 0
        ? "Lavalink session resumed — audio kept playing through the restart, but panels/commands won't reattach until /play or /playlist play runs again for that guild"
        : 'Lavalink session resumed (no players were active)',
    );
  });

  client.on('raw', (packet) => manager.sendRawData(packet));

  return manager;
}

export function getLavalinkManager() {
  if (!manager) throw new Error('Lavalink manager accessed before initialization');
  return manager;
}
