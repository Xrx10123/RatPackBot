import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { infoEmbed } from '../../../core/embeds.js';
import { formatDuration } from '../../../utils/format.js';

const PAGE_SIZE = 10;

function totalDuration(tracks) {
  const finite = tracks.filter((t) => !t.info.isStream);
  return finite.reduce((sum, t) => sum + t.info.duration, 0);
}

export function buildQueuePage(player, page) {
  const tracks = player.queue.tracks;
  const pageCount = Math.max(1, Math.ceil(tracks.length / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 0), pageCount - 1);
  const slice = tracks.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const current = player.queue.current;
  const lines = [];

  if (current) {
    lines.push(`▶️ **${current.info.title}** — ${current.info.isStream ? 'LIVE' : formatDuration(current.info.duration)} *(now playing)*`);
  }

  slice.forEach((track, i) => {
    const position = clampedPage * PAGE_SIZE + i + 1;
    lines.push(`\`${position}.\` ${track.info.title} — ${track.info.isStream ? 'LIVE' : formatDuration(track.info.duration)}`);
  });

  const hasStream = tracks.some((t) => t.info.isStream) || current?.info.isStream;
  const durationLine = `Total: ${formatDuration(totalDuration(tracks))}${hasStream ? ' + live streams' : ''} · ${tracks.length} queued`;

  const embed = infoEmbed({
    title: '📜 Queue',
    description: [...lines, '', durationLine].join('\n'),
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`music:queue_page:${clampedPage - 1}`)
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage === 0),
    new ButtonBuilder()
      .setCustomId(`music:queue_page:${clampedPage + 1}`)
      .setEmoji('➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage >= pageCount - 1),
  );

  return { embeds: [embed], components: pageCount > 1 ? [row] : [] };
}
