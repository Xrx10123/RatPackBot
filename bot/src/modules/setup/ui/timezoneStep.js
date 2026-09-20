import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { infoEmbed } from '../../../core/embeds.js';

export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Moscow',
  'Africa/Johannesburg',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export function buildTimezoneStepPayload(config) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('setup:tz_select')
    .setPlaceholder(`Currently: ${config?.timezone ?? 'UTC'}`)
    .addOptions(COMMON_TIMEZONES.map((tz) => ({ label: tz, value: tz })));

  const row1 = new ActionRowBuilder().addComponents(select);
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:tz_search').setEmoji('🔎').setLabel('Search').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:back').setEmoji('◀️').setLabel('Back').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [infoEmbed({ title: '🕐 Timezone', description: 'Pick a common zone, or search for yours.' })], components: [row1, row2] };
}

export function buildTimezoneSearchModal() {
  return new ModalBuilder()
    .setCustomId('setup:tz_modal')
    .setTitle('Search timezone')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tz')
          .setLabel('IANA timezone (e.g. Europe/Madrid)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Continent/City'),
      ),
    );
}

export function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
