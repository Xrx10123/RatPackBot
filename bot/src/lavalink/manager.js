import { LavalinkManager } from 'lavalink-client';
import { config } from '../config.js';
import { logger } from '../core/logger.js';
import { infoEmbed } from '../core/embeds.js';
import { readSavedSessionId, saveSessionId } from './session.js';
import { getLatestPanelRowForGuild } from '../modules/music/panelStore.js';

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
      count > 0 ? 'Lavalink session resumed — reattaching players' : 'Lavalink session resumed (no players were active)',
    );

    if (!Array.isArray(players)) return;
    for (const raw of players) {
      reattachPlayer(client, raw).catch((err) => logger.warn({ err, guildId: raw.guildId }, 'Could not reattach player after resume'));
    }
  });

  client.on('raw', (packet) => manager.sendRawData(packet));

  return manager;
}

export function getLavalinkManager() {
  if (!manager) throw new Error('Lavalink manager accessed before initialization');
  return manager;
}

/**
 * Recreates a bare Player for a session Lavalink kept alive across a bot
 * restart, WITHOUT calling connect() — the voice link is already live
 * server-side, and calling connect() again would interrupt it. This
 * restores command functionality (/skip, /stop, /pause etc. find a real
 * player instead of "nothing's playing") without risking direct writes into
 * the queue's internal state, which isn't public API and isn't something
 * this session could verify against a live bot. The panel gets an honest
 * "reconnected" notice rather than fabricated now-playing details — it
 * resyncs properly the next time a playback command runs.
 */
async function reattachPlayer(client, raw) {
  const row = getLatestPanelRowForGuild(raw.guildId);
  if (!row) return;

  let player = manager.getPlayer(raw.guildId);
  if (!player) {
    player = manager.createPlayer({
      guildId: raw.guildId,
      voiceChannelId: row.voiceChannelId,
      textChannelId: row.voiceChannelId,
      selfDeaf: true,
      selfMute: false,
    });
  }

  if (!row.messageId) return;
  const channel = await client.channels.fetch(row.voiceChannelId).catch(() => null);
  const message = channel && (await channel.messages.fetch(row.messageId).catch(() => null));
  if (!message) return;

  const trackTitle = raw.track?.info?.title;
  const description = trackTitle
    ? `🐀 Reconnected after a restart — still playing **${trackTitle}**. The panel will resync fully on the next playback command.`
    : '🐀 Reconnected after a restart.';

  await message.edit({ embeds: [infoEmbed({ title: '🎵 The Rat Nest', description })], components: [] }).catch(() => {});
}
