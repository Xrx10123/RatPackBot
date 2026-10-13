import { infoEmbed } from '../core/embeds.js';
import { upsertPanel, stopProgressLoop, retirePanel } from '../modules/music/ui/panel.js';
import { getPanelRow, deletePanelRow, panelMessageChannelId } from '../modules/music/panelStore.js';
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
      const oldChannel = await client.channels.fetch(panelMessageChannelId(oldRow)).catch(() => null);
      const oldMessage = oldChannel && (await oldChannel.messages.fetch(oldRow.messageId).catch(() => null));
      await oldMessage?.delete().catch(() => {});
    }
    deletePanelRow(oldVoiceChannelId);
    await upsertPanel(client, player);
  });

  manager.on('playerDestroy', async (player, reason) => {
    stopProgressLoop(player);
    clearDisconnectTimer(player);
    await retirePanel(client, player, reason).catch((err) => logger.warn({ err }, "Couldn't retire panel after player destroy"));
  });

  manager.on('trackError', (player, track, payload) => {
    logger.error({ err: payload?.exception, track: track?.info?.title, guildId: player.guildId }, 'Lavalink track error');
  });

  manager.on('trackStuck', (player, track) => {
    logger.warn({ track: track?.info?.title, guildId: player.guildId }, 'Lavalink track stuck');
  });

  // Auto-pause when alone, auto-disconnect after a grace period unless 24/7 is on.
  //
  // These fire from the raw gateway packet, which discord.js emits BEFORE it
  // updates its own voice-state cache — so the member list has to be read
  // after yielding a tick, or the person who just left still gets counted
  // and the bot never notices it's alone. lavalink-client also fires
  // playerVoiceLeave for ANY voice update elsewhere in the guild (someone
  // muting in another channel), so this has to be idempotent.
  manager.on('playerVoiceLeave', async (player) => {
    await new Promise((resolve) => setImmediate(resolve));
    const channel = await client.channels.fetch(player.voiceChannelId).catch(() => null);
    if (!channel || humanMemberCount(channel) > 0) return;

    if (player.playing && !player.paused) {
      await player.pause().catch(() => {});
      player.set('autoPaused', true);
    }

    if (getGuildConfig(player.guildId)?.twentyFourSeven) return;
    if (player.get('disconnectTimer')) return; // already counting down

    const timer = setTimeout(async () => {
      player.set('disconnectTimer', null);
      const stillThere = await client.channels.fetch(player.voiceChannelId).catch(() => null);
      if (stillThere && humanMemberCount(stillThere) === 0) {
        await player.destroy('alone-too-long').catch(() => {});
      }
    }, ALONE_DISCONNECT_GRACE_MS);
    timer.unref?.();
    player.set('disconnectTimer', timer);
  });

  manager.on('playerVoiceJoin', async (player) => {
    await new Promise((resolve) => setImmediate(resolve));
    const channel = await client.channels.fetch(player.voiceChannelId).catch(() => null);
    if (!channel || humanMemberCount(channel) === 0) return;

    clearDisconnectTimer(player);

    if (player.get('autoPaused')) {
      await player.resume().catch(() => {});
      player.set('autoPaused', false);
    }
  });
}

function clearDisconnectTimer(player) {
  const timer = player.get('disconnectTimer');
  if (timer) {
    clearTimeout(timer);
    player.set('disconnectTimer', null);
  }
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
