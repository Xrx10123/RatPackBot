import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed } from '../../../core/embeds.js';
import { VARIANTS, MOOD_DISPLAY } from '../variants.js';
import { getMediaForMoment, applyMedia } from '../media.js';

export async function buildSpawnPayload(state, spawn) {
  const variant = VARIANTS[spawn.variant] ?? VARIANTS.normal;
  const mood = MOOD_DISPLAY[state.mood] ?? MOOD_DISPLAY.content;

  const lines = [
    `🐀 **${state.name}** ${variant.intro ?? 'has appeared!'}`,
    `${mood.emoji} ${state.name} ${mood.flavor}`,
    '',
    '🧀 Feed · 💧 Water · 🎾 Play · 😴 Let Her Sleep · 🧼 Clean Cage',
  ];

  const embed = successEmbed({ title: `${variant.label} has appeared!`, description: lines.join('\n') });
  if (variant.color) embed.setColor(variant.color);
  embed.setTimestamp(spawn.expiresAt); // shows Discord's relative "leaves in X" countdown

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`peaches:feed:${spawn.id}`).setEmoji('🧀').setLabel('Feed').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`peaches:water:${spawn.id}`).setEmoji('💧').setLabel('Water').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`peaches:play:${spawn.id}`).setEmoji('🎾').setLabel('Play').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`peaches:sleep:${spawn.id}`).setEmoji('😴').setLabel('Let Her Sleep').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`peaches:clean:${spawn.id}`).setEmoji('🧼').setLabel('Clean Cage').setStyle(ButtonStyle.Secondary),
  );

  const payload = { embeds: [embed], components: [row] };
  // "normal" variant spawns (70% of them) have no variant-specific media, so
  // fall back to the mood's media — keeps every spawn visually alive.
  const media = getMediaForMoment(spawn.variant) ?? getMediaForMoment(state.mood);
  return applyMedia(payload, media);
}
