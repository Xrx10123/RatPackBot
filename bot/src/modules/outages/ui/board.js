import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { infoEmbed } from '../../../core/embeds.js';
import { checkService } from '../checkService.js';
import { listMonitors, updateMonitorStatus } from '../monitors.js';

const STATUS_EMOJI = { up: '🟢', degraded: '🟡', down: '🔴' };

function toStatus(indicator) {
  if (indicator === 'none') return 'up';
  if (indicator === 'minor') return 'degraded';
  return 'down';
}

export function buildStatusBoardPayload(monitors) {
  const embed =
    monitors.length === 0
      ? infoEmbed({ title: '🚨 Status Board', description: '🐀 Nothing monitored yet — try `/outage add`.' })
      : infoEmbed({
          title: '🚨 Status Board',
          description: monitors.map((m) => `${STATUS_EMOJI[m.lastStatus] ?? '⚪'} **${m.serviceName}**${m.lastStatus ? '' : ' *(checking soon)*'}`).join('\n'),
        });

  embed.setTimestamp(); // doubles as "last updated" — refreshed on every manual/auto refresh

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('outages:board_refresh').setEmoji('🔄').setLabel('Refresh').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

/**
 * Actually re-checks every monitored service live (not just re-rendering
 * stale DB state) before building the payload. Deliberately doesn't go
 * through the notification pipeline (checker.js's pollMonitor) — a manual
 * dashboard refresh shouldn't re-trigger @here alerts; that's the 5-minute
 * cron's job.
 */
export async function refreshStatusBoard(guildId) {
  const monitors = listMonitors(guildId);
  for (const m of monitors) {
    try {
      const result = await checkService(m.serviceSlug);
      updateMonitorStatus(m.id, toStatus(result.indicator));
    } catch {
      // leave the last known status if a single check fails — don't blank out a working board over one bad request
    }
  }
  return buildStatusBoardPayload(listMonitors(guildId));
}
