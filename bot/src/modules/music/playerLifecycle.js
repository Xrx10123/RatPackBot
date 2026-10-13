import { getLavalinkManager } from '../../lavalink/manager.js';
import { errorEmbed } from '../../core/embeds.js';

function humanCount(channel) {
  return channel ? channel.members.filter((m) => !m.user.bot).size : 0;
}

/**
 * Gets or creates the guild's player and ensures its voice connection is
 * live. textChannelId is always the voice channel itself — that's where the
 * Rat Nest panel lives (Discord's voice-channel side chat).
 *
 * Returns { player } on success, or { conflictChannelId } when the bot is
 * already busy in a different voice channel that still has listeners — a
 * /play from another channel shouldn't yank the music away from them.
 * If the old channel is empty, the player is moved instead.
 */
export async function ensureConnectedPlayer(guildId, voiceChannel) {
  const manager = getLavalinkManager();
  let player = manager.getPlayer(guildId);

  // A player with no voice channel is a leftover from the bot being
  // disconnected out from under it — connect() can never succeed on it.
  if (player && !player.voiceChannelId) {
    await player.destroy('stale-player').catch(() => {});
    player = null;
  }

  if (player?.get('quiz')) return { quizBusy: true };

  if (player && player.voiceChannelId !== voiceChannel.id) {
    const oldChannel = voiceChannel.guild.channels.cache.get(player.voiceChannelId);
    if (humanCount(oldChannel) > 0) return { conflictChannelId: player.voiceChannelId };
    await player.destroy('moved-to-new-channel').catch(() => {});
    player = null;
  }

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

  return { player };
}

export function voiceConflictEmbed(conflictChannelId) {
  return errorEmbed({ description: `🐀 I'm already playing for folks in <#${conflictChannelId}> — join them, or wait until they're done.` });
}

export const QUIZ_BUSY_TEXT = "🎶 There's a guess-the-song quiz going on — wait for it to finish (or end it with the 🛑 button).";

/** The reason ensureConnectedPlayer() couldn't hand back a player. */
export function blockedEmbed({ quizBusy, conflictChannelId }) {
  return quizBusy ? errorEmbed({ description: QUIZ_BUSY_TEXT }) : voiceConflictEmbed(conflictChannelId);
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

/**
 * Skips the current track, or ends playback cleanly if nothing is queued
 * after it. lavalink-client's skip() throws a RangeError when the queue is
 * empty, which used to surface as "Something broke" on the last song.
 */
export async function skipOrEnd(player) {
  if (player.queue.tracks.length > 0) {
    await player.skip();
  } else {
    await player.skip(0, false);
  }
}
