import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType } from 'discord.js';
import { infoEmbed, errorEmbed } from '../../../core/embeds.js';
import { CHANNEL_PURPOSES } from '../../../core/guildConfig.js';

export function buildChannelStepPayload(purpose, config) {
  const meta = CHANNEL_PURPOSES[purpose];
  const current = config?.[meta.field];

  const embed = infoEmbed({
    title: `${meta.emoji} ${meta.label}`,
    description: [
      `Currently: ${current ? `<#${current}>` : '*not set*'}`,
      '',
      'Pick an existing text channel, or create the full 🐀 Ratpack category — that builds all four channels at once.',
    ].join('\n'),
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`setup:chan_pickmenu:${purpose}`).setEmoji('📁').setLabel('Pick Existing').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:create_all').setEmoji('🆕').setLabel('Create New').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup:back').setEmoji('◀️').setLabel('Back').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

export function buildChannelSelectPayload(purpose) {
  const meta = CHANNEL_PURPOSES[purpose];
  const select = new ChannelSelectMenuBuilder()
    .setCustomId(`setup:chan_select:${purpose}`)
    .setPlaceholder(`Pick a channel for ${meta.label}`)
    .setChannelTypes(ChannelType.GuildText);

  return {
    embeds: [infoEmbed({ description: `${meta.emoji} Pick a channel for **${meta.label}**.` })],
    components: [new ActionRowBuilder().addComponents(select)],
  };
}

/** Creates the 🐀 Ratpack category with all four purpose channels at once. */
export async function createRatpackCategory(guild) {
  const category = await guild.channels.create({ name: '🐀 Ratpack', type: ChannelType.GuildCategory });

  const fields = {};
  for (const meta of Object.values(CHANNEL_PURPOSES)) {
    const channel = await guild.channels.create({ name: meta.defaultName, type: ChannelType.GuildText, parent: category.id });
    fields[meta.field] = channel.id;
  }
  return fields;
}

export function missingManageChannelsEmbed() {
  return errorEmbed({ description: "🐀 I need **Manage Channels** to build the category. Grant it, or use **Pick Existing** instead." });
}
