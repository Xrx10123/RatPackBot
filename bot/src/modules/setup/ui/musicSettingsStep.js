import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { infoEmbed } from '../../../core/embeds.js';

export function buildMusicSettingsPayload(guildConfig) {
  const lines = [
    `DJ role: ${guildConfig?.djRoleId ? `<@&${guildConfig.djRoleId}>` : '*none — anyone can vote-skip*'}`,
    `Vote-skip threshold: **${guildConfig?.voteSkipThreshold ?? 50}%**`,
    `24/7 mode: **${guildConfig?.twentyFourSeven ? 'on' : 'off'}**`,
    '',
    'Change these with `/musicconfig djrole`, `/musicconfig voteskip`, and `/musicconfig 247`.',
  ];

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:back').setEmoji('◀️').setLabel('Back').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [infoEmbed({ title: '🎵 Music Settings', description: lines.join('\n') })], components: [row] };
}
