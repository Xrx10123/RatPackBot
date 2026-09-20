import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { infoEmbed } from '../../../core/embeds.js';
import { CHANNEL_PURPOSES } from '../../../core/guildConfig.js';

const MENTION_LABEL = { here: '@here', none: 'None' };

export function buildHubPayload(config) {
  const lines = Object.values(CHANNEL_PURPOSES).map(
    (meta) => `${meta.emoji} **${meta.label}:** ${config?.[meta.field] ? `<#${config[meta.field]}>` : '*not set*'}`,
  );

  lines.push('', `🕐 **Timezone:** ${config?.timezone ?? 'UTC'}`);

  const mention = config?.defaultMention;
  const mentionText = mention === 'role' && config?.defaultRoleId ? `<@&${config.defaultRoleId}>` : (MENTION_LABEL[mention] ?? '*not set*');
  lines.push(`🔔 **Default ping:** ${mentionText}`);

  const row1 = new ActionRowBuilder().addComponents(
    ...Object.entries(CHANNEL_PURPOSES).map(([key, meta]) =>
      new ButtonBuilder().setCustomId(`setup:chan_open:${key}`).setEmoji(meta.emoji).setLabel(meta.label).setStyle(ButtonStyle.Secondary),
    ),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:create_all').setEmoji('🆕').setLabel('Create Category').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup:tz_open').setEmoji('🕐').setLabel('Timezone').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:mention_open').setEmoji('🔔').setLabel('Mention').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:check').setEmoji('✅').setLabel('Check').setStyle(ButtonStyle.Primary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:peaches_open').setEmoji('🐀').setLabel('Peaches').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:music_open').setEmoji('🎵').setLabel('Music').setStyle(ButtonStyle.Secondary),
  );

  return {
    embeds: [infoEmbed({ title: '🐀 Ratpack Setup', description: lines.join('\n') })],
    components: [row1, row2, row3],
  };
}
