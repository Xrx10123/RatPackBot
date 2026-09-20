import { infoEmbed } from '../core/embeds.js';
import { upsertPanel, stopProgressLoop } from '../modules/music/ui/panel.js';
import { getPanelRow, deletePanelRow } from '../modules/music/panelStore.js';
import { getGuildConfig } from '../core/guildConfig.js';
import { logger } from '../core/logger.js';

const BRIDGE_NOTICE_TTL_MS = 30_000;
const ALONE_DISCONNECT_GRACE_MS = 5 * 60 * 1000;

function humanMemberCount(channel) {
  return channel.members.filter((m) => !m.user.bot).size;
}

/**
 * Wires playback lifecycle events to the Rat Nest panel (M3). The panel is
 * the single now-playing surface — trackStart/queueEnd re-render it in
 * place rather than posting separate messages.
 */
export function registerLavalinkEvents(manager, client) {
  manager.on('trackStart', async (player) => {
    player.set('voteSkips', new Set());

    const message = await upsertPanel(client, player);
    if (!message) return;

    const bridgeChannelId = player.get('bridgeNotice');
    if (bridgeChannelId) {
      player.set('bridgeNotice', null);
      postBridgeNotice(client, player, bridgeChannelId, message).catch((err) =>
        logger.warn({ err }, "Couldn't post discoverability bridge notice"),
      );
    }
  });

  manager.on('queueEnd', async (player) => {
    stopProgressLoop(player);
    await upsertPanel(client, player);
  });

  manager.on('playerMove', async (player, oldVoiceChannelId) => {
    const oldRow = getPanelRow(oldVoiceChannelId);
    if (oldRow?.messageId) {
      const oldChannel = await client.channels.fetch(oldVoiceChannelId).catch(() => null);
      const oldMessage = oldChannel && (await oldChannel.messages.fetch(oldRow.messageId).catch(() => null));
      await oldMessage?.delete().catch(() => {});
    }
    deletePanelRow(oldVoiceChannelId);
    await upsertPanel(client, player);
  });

  manager.on('playerDestroy', (player) => {
    stopProgressLoop(player);
  });

  manager.on('trackError', (player, track, payload) => {
    logger.error({ err: payload?.exception, track: track?.info?.title, guildId: player.guildId }, 'Lavalink track error');
  });

  manager.on('trackStuck', (player, track) => {
    logger.warn({ track: track?.info?.title, guildId: player.guildId }, 'Lavalink track stuck');
  });

  // Auto-pause when alone, auto-disconnect after a grace period unless 24/7 is on.
  manager.on('playerVoiceLeave', async (player) => {
    const channel = await client.channels.fetch(player.voiceChannelId).catch(() => null);
    if (!channel || humanMemberCount(channel) > 0) return;

    if (player.playing && !player.paused) {
      await player.pause().catch(() => {});
      player.set('autoPaused', true);
    }

    if (getGuildConfig(player.guildId)?.twentyFourSeven) return;

    const timer = setTimeout(async () => {
      const stillThere = await client.channels.fetch(player.voiceChannelId).catch(() => null);
      if (stillThere && humanMemberCount(stillThere) === 0) {
        await player.destroy('alone-too-long').catch(() => {});
      }
    }, ALONE_DISCONNECT_GRACE_MS);
    timer.unref?.();
    player.set('disconnectTimer', timer);
  });

  manager.on('playerVoiceJoin', async (player) => {
    const timer = player.get('disconnectTimer');
    if (timer) {
      clearTimeout(timer);
      player.set('disconnectTimer', null);
    }

    if (player.get('autoPaused')) {
      await player.resume().catch(() => {});
      player.set('autoPaused', false);
    }
  });
}

async function postBridgeNotice(client, player, channelId, panelMessage) {
  if (channelId === player.voiceChannelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const link = `https://discord.com/channels/${player.guildId}/${player.voiceChannelId}/${panelMessage.id}`;
  const notice = await channel
    .send({ embeds: [infoEmbed({ description: `🐀 Now playing in <#${player.voiceChannelId}> → [jump to panel](${link})` })] })
    .catch(() => null);

  if (notice) {
    setTimeout(() => notice.delete().catch(() => {}), BRIDGE_NOTICE_TTL_MS).unref?.();
  }
}
