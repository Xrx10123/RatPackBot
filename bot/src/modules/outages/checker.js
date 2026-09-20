import { logger } from '../../core/logger.js';
import { getGuildConfig } from '../../core/guildConfig.js';
import { errorEmbed, successEmbed } from '../../core/embeds.js';
import { checkService } from './checkService.js';
import { listAllEnabled, updateMonitorStatus, markNotified, listOptedInUsers } from './monitors.js';

function toStatus(indicator) {
  if (indicator === 'none') return 'up';
  if (indicator === 'minor') return 'degraded';
  return 'down'; // major | critical
}

function buildMentionToken(guildConfig) {
  if (guildConfig?.defaultMention === 'here') return '@here';
  if (guildConfig?.defaultMention === 'role' && guildConfig.defaultRoleId) return `<@&${guildConfig.defaultRoleId}>`;
  return '';
}

export async function pollMonitor(client, row) {
  let result;
  try {
    result = await checkService(row.serviceSlug);
  } catch {
    result = { indicator: 'major', description: 'Check failed' };
  }

  const newStatus = toStatus(result.indicator);
  const oldStatus = row.lastStatus;
  updateMonitorStatus(row.id, newStatus);

  const wentDown = newStatus === 'down' && oldStatus === 'up';
  const recovered = newStatus === 'up' && oldStatus === 'down';
  if (!wentDown && !recovered) return;

  const guildConfig = getGuildConfig(row.guildId);
  if (!guildConfig?.outageChannelId) return;

  const channel = await client.channels.fetch(guildConfig.outageChannelId).catch(() => null);
  if (!channel) return;

  const mentionToken = buildMentionToken(guildConfig);
  const personalMentions = listOptedInUsers(row.guildId, row.serviceSlug)
    .map((u) => `<@${u.userId}>`)
    .join(' ');
  const content = [mentionToken, personalMentions].filter(Boolean).join(' ') || undefined;

  const embed = wentDown
    ? errorEmbed({ description: `🚨 **${row.serviceName}** appears to be down.${result.description ? ` ${result.description}` : ''}` })
    : successEmbed({ description: `🐀 The rats report **${row.serviceName}** servers have crawled back online.` });

  await channel.send({ content, embeds: [embed] }).catch(() => {});
  markNotified(row.id);
}

export async function pollAllOutages(client) {
  const rows = listAllEnabled();
  for (const row of rows) {
    await pollMonitor(client, row).catch((err) => logger.warn({ err, monitorId: row.id, service: row.serviceName }, 'Outage poll failed'));
  }
}
