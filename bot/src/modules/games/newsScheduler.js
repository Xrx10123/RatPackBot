import { logger } from '../../core/logger.js';
import { infoEmbed } from '../../core/embeds.js';
import { getGuildConfig } from '../../core/guildConfig.js';
import { getNewsForApp } from './providers/steam.js';
import { listAllEnabled, updateLastChecked } from './newsSubscriptions.js';

function stripHtml(text) {
  return (text ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim();
}

export async function pollOne(client, sub) {
  const guildConfig = getGuildConfig(sub.guildId);
  if (!guildConfig?.newsChannelId) return;

  const channel = await client.channels.fetch(guildConfig.newsChannelId).catch(() => null);
  if (!channel) return;

  const tags = sub.tagFilter ? sub.tagFilter.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const items = await getNewsForApp(sub.steamAppid, { count: 10, tags });

  const since = sub.lastCheckedAt ?? 0;
  const fresh = items.filter((item) => item.date * 1000 > since).sort((a, b) => a.date - b.date);

  for (const item of fresh) {
    const embed = infoEmbed({
      title: `📰 ${sub.gameName}: ${item.title}`,
      description: [stripHtml(item.contents).slice(0, 350), '', `[Read more](${item.url})`].join('\n'),
    });
    await channel.send({ embeds: [embed] }).catch(() => {});
  }

  updateLastChecked(sub.id, Date.now());
}

export async function pollAllNews(client) {
  const subs = listAllEnabled();
  for (const sub of subs) {
    await pollOne(client, sub).catch((err) => logger.warn({ err, subscriptionId: sub.id, game: sub.gameName }, 'News poll failed'));
  }
}
