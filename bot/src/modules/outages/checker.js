import { logger } from '../../core/logger.js';
import { getGuildConfig } from '../../core/guildConfig.js';
import { errorEmbed, successEmbed } from '../../core/embeds.js';
import { checkService } from './checkService.js';
import { listAllEnabled, recordPoll, markNotified, listOptedInUsers } from './monitors.js';
import { evaluatePoll } from './alerting.js';

function buildMentionToken(guildConfig) {
  if (guildConfig?.defaultMention === 'here') return '@here';
  if (guildConfig?.defaultMention === 'role' && guildConfig.defaultRoleId) return `<@&${guildConfig.defaultRoleId}>`;
  return '';
}

/**
 * @param {Map<string, Promise>} [resultCache] shared across one poll sweep so
 *   ten guilds all watching Discord cost one request to discordstatus.com, not ten.
 */
export async function pollMonitor(client, row, resultCache = new Map()) {
  if (!resultCache.has(row.serviceSlug)) {
    resultCache.set(
      row.serviceSlug,
      checkService(row.serviceSlug).then(
        (result) => ({ ...result, fetchFailed: false }),
        () => ({ fetchFailed: true, description: "Couldn't reach its status page" }),
      ),
    );
  }
  const result = await resultCache.get(row.serviceSlug);

  const decision = evaluatePoll(row, result);
  recordPoll(row.id, decision);
  if (!decision.notify) return;

  const guildConfig = getGuildConfig(row.guildId);
  if (!guildConfig?.outageChannelId) return;

  const channel = await client.channels.fetch(guildConfig.outageChannelId).catch(() => null);
  if (!channel) return;

  const wentDown = decision.notify === 'down';
  const mentionToken = buildMentionToken(guildConfig);
  const personalMentions = listOptedInUsers(row.guildId, row.serviceSlug)
    .map((u) => `<@${u.userId}>`)
    .join(' ');
  const content = [mentionToken, personalMentions].filter(Boolean).join(' ') || undefined;

  const embed = wentDown
    ? errorEmbed({ description: `🚨 **${row.serviceName}** appears to be down.${result.description ? ` ${result.description}.` : ''}` })
    : successEmbed({ description: `🐀 The rats report **${row.serviceName}** servers have crawled back online.` });

  await channel.send({ content, embeds: [embed], allowedMentions: { parse: ['everyone', 'roles', 'users'] } }).catch(() => {});
  markNotified(row.id);
}

export async function pollAllOutages(client) {
  const rows = listAllEnabled();
  const resultCache = new Map();
  for (const row of rows) {
    if (!client.guilds.cache.has(row.guildId)) continue; // bot was removed from that server
    await pollMonitor(client, row, resultCache).catch((err) => logger.warn({ err, monitorId: row.id, service: row.serviceName }, 'Outage poll failed'));
  }
}
