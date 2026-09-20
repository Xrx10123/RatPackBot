import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { warnEmbed, infoEmbed, errorEmbed } from '../../../core/embeds.js';
import { getMediaForMoment, applyMedia } from '../media.js';

export function buildTurdPayload(name, mischiefId, { stale = false } = {}) {
  const description = stale
    ? `💩 This has been here a while. ${name} is pleased.`
    : `💩 ${name} has been here. Evidence attached.`;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`peaches:mischief_clean:${mischiefId}`).setEmoji('🧹').setLabel('Clean Up').setStyle(ButtonStyle.Secondary),
  );
  return applyMedia({ embeds: [warnEmbed({ description })], components: [row] }, getMediaForMoment('turd'));
}

export function buildHolePayload(name, mischiefId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`peaches:hole_investigate:${mischiefId}`).setEmoji('🕳').setLabel('Investigate').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`peaches:hole_ignore:${mischiefId}`).setEmoji('🚫').setLabel('Ignore Her').setStyle(ButtonStyle.Secondary),
  );
  return applyMedia({ embeds: [infoEmbed({ description: `🕳 ${name} found a hole. She is thinking about it.` })], components: [row] }, getMediaForMoment('hole'));
}

export function buildShredPayload(name, mischiefId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`peaches:escalation_resolve:${mischiefId}`).setLabel('Restore Order').setEmoji('🧻').setStyle(ButtonStyle.Danger),
  );
  return applyMedia({ embeds: [errorEmbed({ description: `🧻 ${name} has shredded the toilet paper.` })], components: [row] }, getMediaForMoment('shred'));
}

export function buildWallsPayload(name, mischiefId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`peaches:walls_knock:${mischiefId}`).setLabel('Knock on the wall').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`peaches:escalation_resolve:${mischiefId}`).setLabel('Ignore it').setStyle(ButtonStyle.Secondary),
  );
  return applyMedia({ embeds: [errorEmbed({ description: `📦 ${name} has moved into the walls.` })], components: [row] }, getMediaForMoment('walls'));
}

export function buildRulerPayload(name, mischiefId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`peaches:fealty:${mischiefId}`).setLabel('Pledge Fealty').setEmoji('👑').setStyle(ButtonStyle.Danger),
  );
  return applyMedia({ embeds: [errorEmbed({ description: `👑 ${name} has declared herself ruler of this server.` })], components: [row] }, getMediaForMoment('ruler'));
}
