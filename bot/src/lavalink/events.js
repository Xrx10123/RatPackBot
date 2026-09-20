import { successEmbed, warnEmbed } from '../core/embeds.js';
import { formatDuration } from '../utils/format.js';
import { flavor, FLAVOR } from '../utils/ratpack.js';
import { logger } from '../core/logger.js';

/**
 * Wires playback lifecycle events to Discord feedback. The Rat Nest voice
 * panel (M3) will take over "now playing" rendering later — for now this
 * posts a plain embed in the channel the track was requested from.
 */
export function registerLavalinkEvents(manager, client) {
  manager.on('trackStart', async (player, track) => {
    const channel = player.textChannelId && (await resolveChannel(client, player));
    if (!channel) return;

    const embed = successEmbed({
      title: '🎵 Now Playing',
      description: [
        `**[${track.info.title}](${track.info.uri})**`,
        `${track.info.author} · ${formatDuration(track.info.duration)}`,
        flavor(FLAVOR.nowPlaying),
      ]
        .filter(Boolean)
        .join('\n'),
      thumbnail: track.info.artworkUrl ?? undefined,
    });

    channel.send({ embeds: [embed] }).catch((err) => logger.warn({ err }, "Couldn't post now-playing message"));
  });

  manager.on('queueEnd', async (player) => {
    const channel = player.textChannelId && (await resolveChannel(client, player));
    if (channel) {
      channel
        .send({ embeds: [warnEmbed({ description: "🐀 Queue's empty. The rats have nothing left to sniff out." })] })
        .catch(() => {});
    }
  });

  manager.on('trackError', (player, track, payload) => {
    logger.error({ err: payload?.exception, track: track?.info?.title, guildId: player.guildId }, 'Lavalink track error');
  });

  manager.on('trackStuck', (player, track) => {
    logger.warn({ track: track?.info?.title, guildId: player.guildId }, 'Lavalink track stuck');
  });
}

async function resolveChannel(client, player) {
  try {
    return await client.channels.fetch(player.textChannelId);
  } catch {
    return null;
  }
}
