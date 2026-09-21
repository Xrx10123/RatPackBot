import { successEmbed, infoEmbed, errorEmbed } from '../../../core/embeds.js';
import { getMischiefById, resolveMischief, resolveAllPending } from '../mischiefStore.js';
import { getCurrentState, nudgeStats, resetToContent } from '../state.js';
import { incrementStat } from '../stats.js';

async function alreadyHandled(interaction) {
  await interaction.reply({ embeds: [infoEmbed({ description: '🐀 Someone already took care of that.' })], ephemeral: true });
}

export const mischiefButtons = {
  async mischief_clean(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveMischief(row.id, interaction.user.id);
    incrementStat(interaction.guildId, interaction.user.id, 'clean');

    await interaction.update({ embeds: [successEmbed({ description: `🧹 ${interaction.user} cleaned up. Tidy!` })], components: [] });
  },

  async hole_investigate(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveMischief(row.id, interaction.user.id);
    incrementStat(interaction.guildId, interaction.user.id, 'investigate');

    const state = getCurrentState(interaction.guildId);
    const lucky = Math.random() < 0.1;
    const lines = ['🕳 You peer into the hole. Peaches stares back. Nothing happens. You feel watched.'];
    if (lucky) {
      nudgeStats(interaction.guildId, { happiness: 10 });
      lines.push(`✨ ...actually, ${state.name} tosses you something shiny. Lucky!`);
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
    await interaction.update({ embeds: [successEmbed({ description: '🐀 Order, mostly restored.' })], components: [] });
  },

  async walls_knock(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveMischief(row.id, interaction.user.id);
    incrementStat(interaction.guildId, interaction.user.id, 'wall');

    await interaction.update({ embeds: [infoEmbed({ description: 'You knock on the wall. No answer. Somewhere, a rat giggles.' })], components: [] });
  },

  async fealty(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveAllPending(interaction.guildId);
    const state = resetToContent(interaction.guildId);
    incrementStat(interaction.guildId, interaction.user.id, 'fealty');

    await interaction.update({
      embeds: [successEmbed({ description: `👑 ${interaction.user} has pledged fealty. ${state.name} accepts your service. Order is restored.` })],
      components: [],
    });
  },

  async crumbs_thank(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveMischief(row.id, interaction.user.id);
    nudgeStats(interaction.guildId, { happiness: 5 });

    await interaction.update({ embeds: [successEmbed({ description: `🐀 ${interaction.user} says thanks. She seems pleased with herself.` })], components: [] });
  },

  async gift_thank(interaction, mischiefId) {
    const row = getMischiefById(mischiefId);
    if (!row || row.resolved) return alreadyHandled(interaction);

    resolveMischief(row.id, interaction.user.id);
    const state = nudgeStats(interaction.guildId, { happiness: 10 });

    await interaction.update({ embeds: [successEmbed({ description: `🙏 ${interaction.user} accepts the gift graciously. ${state.name} preens with pride.` })], components: [] });
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
