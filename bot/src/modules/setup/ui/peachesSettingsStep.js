import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { eq } from 'drizzle-orm';
import { infoEmbed } from '../../../core/embeds.js';
import { db } from '../../../db/index.js';
import { peachesConfig, peachesState } from '../../../db/schema.js';

// Reads the shared schema tables directly (same pattern every module uses
// for shared/core state) rather than importing modules/peaches's own
// function files — the actual settings changes still happen through /pet,
// this is a read-only summary + pointer.
export function buildPeachesSettingsPayload(guildId) {
  const config = db.select().from(peachesConfig).where(eq(peachesConfig.guildId, guildId)).get();
  const state = db.select().from(peachesState).where(eq(peachesState.guildId, guildId)).get();

  const spawnChannels = config?.spawnChannels ? config.spawnChannels.split(',').filter(Boolean) : [];

  const lines = [
    `Name: **${state?.name ?? 'Peaches'}**`,
    `Spawn channels: ${spawnChannels.length > 0 ? spawnChannels.map((id) => `<#${id}>`).join(', ') : '*none set — she has nowhere to appear yet*'}`,
    `Mischief: **${config?.mischiefEnabled ? 'on' : 'off'}** (frequency: **${config?.mischiefFrequency ?? 'normal'}**)`,
    `Escalation ladder: **${config?.escalationEnabled ? 'on' : 'off'}**`,
    `Cross-module hooks — Music: **${config?.crossMusic ? 'on' : 'off'}** · News: **${config?.crossNews ? 'on' : 'off'}** · Outages: **${config?.crossOutages ? 'on' : 'off'}** · Hoards: **${config?.crossHoards ? 'on' : 'off'}**`,
    '',
    'Change these with `/pet channels`, `/pet config`, and `/pet mischief`.',
  ];

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:back').setEmoji('◀️').setLabel('Back').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [infoEmbed({ title: '🐀 Peaches Settings', description: lines.join('\n') })], components: [row] };
}
