import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed } from '../../../core/embeds.js';
import { getGuildConfig } from '../../../core/guildConfig.js';
import { VARIANTS, MOOD_DISPLAY, pickLine } from '../variants.js';
import { SEASONS, getActiveSeason } from '../seasons.js';
import { getMediaForMoment, applyMedia } from '../media.js';
import { outfitLine, outfitEmojis } from '../wardrobe.js';

/** Which media key a spawn shows: variant art first, then seasonal art (half the time), then mood. */
export function spawnMediaKey(spawn, state, season, random = Math.random) {
  if (getMediaForMoment(spawn.variant)) return spawn.variant;
  if (season && random() < 0.5) return SEASONS[season].media;
  return state.mood;
}

export async function buildSpawnPayload(state, spawn, { now = new Date() } = {}) {
  const variant = VARIANTS[spawn.variant] ?? VARIANTS.normal;
  const mood = MOOD_DISPLAY[state.mood] ?? MOOD_DISPLAY.content;
  const seasonKey = getActiveSeason(now, getGuildConfig(spawn.guildId)?.timezone);
  const season = seasonKey ? SEASONS[seasonKey] : null;

  const lines = [`🐀 **${state.name}** ${variant.intro ? pickLine(variant.intro) : 'has appeared!'}`];
  if (season && spawn.variant !== 'ghost') lines.push(`${season.emoji} ${state.name} ${pickLine(season.costume)}`);
  const outfit = outfitLine(spawn.guildId);
  if (outfit) lines.push(outfit);
  lines.push(`${mood.emoji} ${state.name} ${pickLine(mood.flavor)}`, '', '🧀 Feed · 💧 Water · 🎾 Play · 😴 Let Her Sleep · 🧼 Clean Cage');
  if (seasonKey === 'halloween') lines.push('🍬 Trick or treat? Everyone gets one knock per visit.');

  const worn = outfitEmojis(spawn.guildId);
  const title = `${season ? `${season.emoji} ` : ''}${variant.label}${worn ? ` ${worn}` : ''} has appeared!`;
  const embed = successEmbed({ title, description: lines.join('\n') });
  embed.setColor(variant.color ?? season?.color ?? embed.data.color);
  embed.setTimestamp(spawn.expiresAt); // shows Discord's relative "leaves in X" countdown

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`peaches:feed:${spawn.id}`).setEmoji('🧀').setLabel('Feed').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`peaches:water:${spawn.id}`).setEmoji('💧').setLabel('Water').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`peaches:play:${spawn.id}`).setEmoji('🎾').setLabel('Play').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`peaches:sleep:${spawn.id}`).setEmoji('😴').setLabel('Let Her Sleep').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`peaches:clean:${spawn.id}`).setEmoji('🧼').setLabel('Clean Cage').setStyle(ButtonStyle.Secondary),
    ),
  ];
  if (seasonKey === 'halloween') {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`peaches:trickortreat:${spawn.id}`).setEmoji('🎃').setLabel('Trick or Treat!').setStyle(ButtonStyle.Danger),
      ),
    );
  }

  return applyMedia({ embeds: [embed], components: rows }, getMediaForMoment(spawnMediaKey(spawn, state, seasonKey)));
}
