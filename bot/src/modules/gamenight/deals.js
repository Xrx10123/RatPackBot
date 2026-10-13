import { successEmbed } from '../../core/embeds.js';
import { getGuildConfig } from '../../core/guildConfig.js';
import { peachesName } from '../../core/peachesVoice.js';
import { logger } from '../../core/logger.js';
import { escapeMarkdown } from '../../utils/text.js';
import { listLinkedGames, recordDealState, markFreeGamePosted } from './store.js';
import { getSteamPrices, getEpicFreeGames, steamStoreUrl } from './storefronts.js';

export const MIN_DISCOUNT = 10;

/**
 * Whether a price change is worth a post. A sale is announced once when it
 * starts, and again only if it gets deeper; when it ends the state resets
 * so the next sale is news again.
 * @returns {{ announce: boolean, dealPercent: number }}
 */
export function decideDeal(game, price) {
  const percent = price?.percent ?? 0;
  if (percent < MIN_DISCOUNT) return { announce: false, dealPercent: 0 };
  const previous = game.dealPercent ?? 0;
  return { announce: percent > previous, dealPercent: Math.max(percent, previous) };
}

export function dealLine(game, price) {
  return `💸 **[${escapeMarkdown(game.name)}](${steamStoreUrl(game.steamAppid)})** is **${price.percent}% off** — ${price.finalFormatted} ~~${price.initialFormatted}~~`;
}

async function alertChannel(client, guildId) {
  const cfg = getGuildConfig(guildId);
  for (const id of [cfg?.newsChannelId, cfg?.socialChannelId]) {
    const channel = id ? await client.channels.fetch(id).catch(() => null) : null;
    if (channel?.isTextBased?.()) return channel;
  }
  return null;
}

export async function dealTick(client, { prices = null } = {}) {
  const games = listLinkedGames().filter((g) => client.guilds.cache.has(g.guildId));
  if (games.length === 0) return 0;
  const priceMap = prices ?? (await getSteamPrices(games.map((g) => g.steamAppid)));

  const byGuild = new Map();
  for (const game of games) {
    const price = priceMap[game.steamAppid];
    if (!price) continue;
    const decision = decideDeal(game, price);
    if (decision.dealPercent !== (game.dealPercent ?? 0) || decision.announce) {
      recordDealState(game.id, { dealPercent: decision.dealPercent, alertedAt: decision.announce ? Date.now() : undefined });
    }
    if (decision.announce && getGuildConfig(game.guildId)?.dealAlerts !== 0) {
      if (!byGuild.has(game.guildId)) byGuild.set(game.guildId, []);
      byGuild.get(game.guildId).push(dealLine(game, price));
    }
  }

  let posted = 0;
  for (const [guildId, lines] of byGuild) {
    const channel = await alertChannel(client, guildId);
    if (!channel) continue;
    const name = peachesName(guildId);
    const embed = successEmbed({
      title: lines.length > 1 ? '💸 Sales on your game night list!' : '💸 Sale on your game night list!',
      description: [...lines, '', `-# ${name} found these on Steam. She would like a cut, paid in cheese.`].join('\n').slice(0, 4000),
    });
    await channel.send({ embeds: [embed] }).catch((err) => logger.warn({ err, guildId }, 'Could not post deals'));
    posted += lines.length;
  }
  return posted;
}

export async function freeGameTick(client, { freeGames = null, now = Date.now() } = {}) {
  const guilds = [...client.guilds.cache.values()].filter((g) => getGuildConfig(g.id)?.freeGameAlerts !== 0);
  if (guilds.length === 0) return 0;
  const free = freeGames ?? (await getEpicFreeGames(now));
  let posted = 0;
  for (const guild of guilds) {
    const channel = await alertChannel(client, guild.id);
    if (!channel) continue;
    for (const game of free) {
      if (!markFreeGamePosted(guild.id, game.key)) continue;
      const embed = successEmbed({
        title: `🎁 Free on Epic: ${game.title}`.slice(0, 256),
        description: `**[Claim it here](${game.url})** — free to keep until <t:${Math.floor(game.endsAt / 1000)}:F> (<t:${Math.floor(game.endsAt / 1000)}:R>).\n-# ${peachesName(guild.id)} already claimed hers. She can't play it. She doesn't care.`,
      });
      if (game.image) embed.setImage(game.image);
      await channel.send({ embeds: [embed] }).catch((err) => logger.warn({ err, guildId: guild.id }, 'Could not post free game'));
      posted += 1;
    }
  }
  return posted;
}
