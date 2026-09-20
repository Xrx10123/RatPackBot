import { getLavalinkManager } from '../../lavalink/manager.js';

/**
 * Gets or creates the guild's player and ensures its voice connection is
 * live. textChannelId is always the voice channel itself — that's where the
 * Rat Nest panel lives (Discord's voice-channel side chat).
 */
export async function ensureConnectedPlayer(guildId, voiceChannel) {
  const manager = getLavalinkManager();
  let player = manager.getPlayer(guildId);

  if (!player) {
    player = manager.createPlayer({
      guildId,
      voiceChannelId: voiceChannel.id,
      textChannelId: voiceChannel.id,
      selfDeaf: true,
      selfMute: false,
      volume: 100,
    });
  }

  if (!player.connected) {
    await player.connect();
  }

  return player;
}

/**
 * Records where a /play (or similar) command was run from, when that's a
 * different channel than the voice channel's own panel. The trackStart
 * handler consumes this once to post the "Now playing in [VC]" discoverability
 * bridge notice, per the design doc.
 */
export function markBridgeNotice(player, commandChannelId) {
  if (commandChannelId !== player.voiceChannelId) {
    player.set('bridgeNotice', commandChannelId);
  }
}
