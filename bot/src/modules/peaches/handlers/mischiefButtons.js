import { successEmbed, infoEmbed, errorEmbed } from '../../../core/embeds.js';
import { getMischiefById, resolveMischief, resolveAllPending } from '../mischiefStore.js';
import { getCurrentState, nudgeStats, resetToContent } from '../state.js';
import { incrementStat } from '../stats.js';
import { reward, earnedSuffix } from '../economy.js';
import { maybeFindSomething, foundLine } from '../collectibles.js';
import { getActiveSeason } from '../seasons.js';
import { getGuildConfig } from '../../../core/guildConfig.js';

async function alreadyHandled(interaction) {
  await interaction.reply({ embeds: [infoEmbed({ description: '🐀 Someone already took care of that.' })], ephemeral: true });
}

export const mischiefButtons = {
  async mischief_clean(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveMischief(row.id, interaction.user.id);
    const earned = reward(interaction.guildId, interaction.user.id, 'mischief');
    incrementStat(interaction.guildId, interaction.user.id, 'clean');

    await interaction.update({ embeds: [successEmbed({ description: `🧹 ${interaction.user} cleaned up. Tidy!${earnedSuffix(earned)}` })], components: [] });
  },

  async hole_investigate(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveMischief(row.id, interaction.user.id);
    const earned = reward(interaction.guildId, interaction.user.id, 'mischief');
    incrementStat(interaction.guildId, interaction.user.id, 'investigate');

    const state = getCurrentState(interaction.guildId);
    const lucky = Math.random() < 0.1;
    const lines = [`🕳 You peer into the hole. ${state.name} stares back. Nothing happens. You feel watched.${earnedSuffix(earned)}`];
    if (lucky) {
      nudgeStats(interaction.guildId, { happiness: 10 });
      const season = getActiveSeason(new Date(), getGuildConfig(interaction.guildId)?.timezone);
      const item = maybeFindSomething(interaction.guildId, interaction.user.id, { chance: 1, season });
      lines.push(item ? `✨ ...actually, ${foundLine(state.name, interaction.user, item)}` : `✨ ...actually, ${state.name} tosses you something shiny. Lucky!`);
    }

    await interaction.update({ embeds: [infoEmbed({ description: lines.join('\n') })], components: [] });
  },

  async hole_ignore(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveMischief(row.id, interaction.user.id);
    await interaction.update({ embeds: [infoEmbed({ description: "🚫 You walk away. The hole remains, unexplained." })], components: [] });
  },

  async escalation_resolve(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveMischief(row.id, interaction.user.id);
    const earned = reward(interaction.guildId, interaction.user.id, 'mischief');
    await interaction.update({ embeds: [successEmbed({ description: `🐀 Order, mostly restored.${earnedSuffix(earned)}` })], components: [] });
  },

  async walls_knock(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveMischief(row.id, interaction.user.id);
    const earned = reward(interaction.guildId, interaction.user.id, 'mischief');
    incrementStat(interaction.guildId, interaction.user.id, 'wall');

    await interaction.update({ embeds: [infoEmbed({ description: `You knock on the wall. No answer. Somewhere, a rat giggles.${earnedSuffix(earned)}` })], components: [] });
  },

  async fealty(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveAllPending(interaction.guildId);
    const state = resetToContent(interaction.guildId);
    incrementStat(interaction.guildId, interaction.user.id, 'fealty');
    const earned = reward(interaction.guildId, interaction.user.id, 'fealty');

    await interaction.update({
      embeds: [successEmbed({ description: `👑 ${interaction.user} has pledged fealty. ${state.name} accepts your service. Order is restored.${earnedSuffix(earned)}` })],
      components: [],
    });
  },

  async crumbs_thank(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveMischief(row.id, interaction.user.id);
    const earned = reward(interaction.guildId, interaction.user.id, 'thanks');
    nudgeStats(interaction.guildId, { happiness: 5 });

    await interaction.update({ embeds: [successEmbed({ description: `🐀 ${interaction.user} says thanks. She seems pleased with herself.${earnedSuffix(earned)}` })], components: [] });
  },

  async gift_thank(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveMischief(row.id, interaction.user.id);
    const earned = reward(interaction.guildId, interaction.user.id, 'thanks');
    const state = nudgeStats(interaction.guildId, { happiness: 10 });

    await interaction.update({ embeds: [successEmbed({ description: `🙏 ${interaction.user} accepts the gift graciously. ${state.name} preens with pride.${earnedSuffix(earned)}` })], components: [] });
  },

  async gift_decline(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveMischief(row.id, interaction.user.id);
    const state = getCurrentState(interaction.guildId);

    await interaction.update({ embeds: [infoEmbed({ description: `🙅 ${interaction.user} politely declines. ${state.name} looks a little hurt but shrugs it off.` })], components: [] });
  },

  // Non-exclusive — anyone can click it, no mischief row to resolve. Just a shared reaction.
  async bite_react(interaction) {
    const state = getCurrentState(interaction.guildId);
    await interaction.reply({ embeds: [infoEmbed({ description: `😤 Noted. ${state.name} does not appear to regret it.` })], ephemeral: true });
  },
};
