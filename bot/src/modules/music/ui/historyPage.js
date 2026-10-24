import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { infoEmbed } from '../../../core/embeds.js';
import { formatDuration } from '../../../utils/format.js';
import { getHistoryCount, getHistoryTracks } from '../history.js';

const PAGE_SIZE = 10;

export function buildHistoryPage(guildId, page) {
  const total = getHistoryCount(guildId);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 0), pageCount - 1);
  const rows = total > 0 ? getHistoryTracks(guildId, clampedPage * PAGE_SIZE, PAGE_SIZE) : [];

  const lines = rows.map((row, i) => {
    const position = clampedPage * PAGE_SIZE + i + 1;
    const duration = row.duration ? formatDuration(row.duration) : 'LIVE';
    const requester = row.requesterId ? ` · <@${row.requesterId}>` : '';
    const played = row.playedAt ? ` · <t:${Math.floor(row.playedAt / 1000)}:R>` : '';
    return `\`${position}.\` ${row.title ?? 'Unknown track'} — ${duration}${requester}${played}`;
  });

  const embed = infoEmbed({
    title: '🕓 Play History',
    description: total > 0 ? [...lines, '', `${total} tracked play${total === 1 ? '' : 's'}`].join('\n') : "🐀 Nothing's played here yet.",
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`music:history_page:${clampedPage - 1}`)
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage === 0),
    new ButtonBuilder()
      .setCustomId(`music:history_page:${clampedPage + 1}`)
      .setEmoji('➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage >= pageCount - 1),
  );

  return { embeds: [embed], components: pageCount > 1 ? [row] : [] };
}
