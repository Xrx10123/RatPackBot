import { ActionRowBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder } from 'discord.js';
import { infoEmbed } from '../../../core/embeds.js';

export function buildMentionStepPayload() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:mention_here').setLabel('@here').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:mention_rolemenu').setLabel('Choose Role').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:mention_none').setLabel('None').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:back').setEmoji('◀️').setLabel('Back').setStyle(ButtonStyle.Secondary),
  );

  return {
    embeds: [infoEmbed({ title: '🔔 Default Notification Ping', description: 'Used for outage alerts and other pings that need attention.' })],
    components: [row],
  };
}

export function buildRoleSelectPayload() {
  const select = new RoleSelectMenuBuilder().setCustomId('setup:mention_roleselect').setPlaceholder('Pick a role');
  return {
    embeds: [infoEmbed({ description: '🔔 Pick the role to ping.' })],
    components: [new ActionRowBuilder().addComponents(select)],
  };
}
