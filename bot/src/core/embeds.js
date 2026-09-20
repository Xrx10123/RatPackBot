import { EmbedBuilder } from 'discord.js';

export const COLORS = {
  success: 0x39ff14, // toxic green — music, success, all-good states
  warn: 0xffb300, // amber — warnings, degraded states, cooldowns
  error: 0xe53935, // red — outages, errors, critical states
  info: 0x4a4a4a, // grey — info, config, neutral
};

function base() {
  return new EmbedBuilder().setFooter({ text: '🐀 Ratpack' });
}

export function successEmbed({ title, description, thumbnail } = {}) {
  const embed = base().setColor(COLORS.success);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
}

export function warnEmbed({ title, description, thumbnail } = {}) {
  const embed = base().setColor(COLORS.warn);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
}

export function errorEmbed({ title, description, thumbnail } = {}) {
  const embed = base().setColor(COLORS.error);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
}

export function infoEmbed({ title, description, thumbnail } = {}) {
  const embed = base().setColor(COLORS.info);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
}

/**
 * Problem, cause, fix — one line, plus a link. Matches the Error Format spec:
 * "🐀 I can't post in #rat-nest — I'm missing **Send Messages**. Fix it here → [link]"
 */
export function permissionErrorEmbed({ channel, missingPermission, fixUrl }) {
  const channelRef = channel ? `<#${channel.id ?? channel}>` : 'that channel';
  const lines = [`🐀 I can't post in ${channelRef} — I'm missing **${missingPermission}**.`];
  if (fixUrl) lines.push(`Fix it here → ${fixUrl}`);
  return errorEmbed({ description: lines.join('\n') });
}
