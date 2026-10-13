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
      'Pick an existing text channel, or let me create the 🐀 Ratpack category — it builds every channel that isn\'t set up yet.',
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

const CATEGORY_NAME = '🐀 Ratpack';

/**
 * Creates the 🐀 Ratpack category and a channel for every purpose that
 * isn't set up yet (or whose channel was deleted). Re-running it — e.g. to
 * get a newly added purpose — reuses the existing category and never
 * duplicates channels that already work.
 */
export async function createRatpackCategory(guild, config = {}) {
  const existingCategory = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME);
  const category = existingCategory ?? (await guild.channels.create({ name: CATEGORY_NAME, type: ChannelType.GuildCategory }));

  const fields = {};
  for (const meta of Object.values(CHANNEL_PURPOSES)) {
    const currentId = config?.[meta.field];
    if (currentId && guild.channels.cache.has(currentId)) continue;
    const channel = await guild.channels.create({ name: meta.defaultName, type: ChannelType.GuildText, parent: category.id });
    fields[meta.field] = channel.id;
  }
  return fields;
}

export function missingManageChannelsEmbed() {
  return errorEmbed({ description: "🐀 I need **Manage Channels** to build the category. Grant it, or use **Pick Existing** instead." });
}
