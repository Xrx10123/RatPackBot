import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed } from '../../core/embeds.js';
import { checkChannelPermissions } from '../../core/permissions.js';
import { ensureGuildConfig } from './guildConfig.js';

export function buildWelcomePayload() {
  const embed = successEmbed({
    title: '🐀 Welcome to Ratpack!',
    description:
      "I'm your pack's new rat — music, game stats, outage alerts, and one very opinionated pet rat. Let's get you set up.",
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:welcome_start').setEmoji('🐀').setLabel('Set Me Up').setStyle(ButtonStyle.Success),
  );

  return { embeds: [embed], components: [row] };
}

export async function handleGuildCreate(client, guild) {
  ensureGuildConfig(guild.id);

  const candidates = [guild.systemChannel, ...guild.channels.cache.filter((c) => c.isTextBased()).values()].filter(Boolean);
  const channel = candidates.find((c) => checkChannelPermissions(c, ['SendMessages', 'EmbedLinks']).ok);
  if (!channel) return;

  await channel.send(buildWelcomePayload()).catch(() => {});
}
