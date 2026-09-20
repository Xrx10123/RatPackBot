import { errorEmbed, successEmbed } from '../../../core/embeds.js';
import { getSpawnById } from '../spawns.js';
import { getActionCooldownRemaining, applyInteraction, getFirstInteractor } from '../state.js';
import { VARIANTS } from '../variants.js';
import { buildSpawnPayload } from '../ui/spawnEmbed.js';
import { getMediaForMoment, applyMedia } from '../media.js';

const ACTION_LABELS = { feed: 'fed her cheese', water: 'gave her water', play: 'played with her', sleep: 'let her sleep', clean: 'cleaned her cage' };

function formatCooldown(ms) {
  const minutes = Math.ceil(ms / 60000);
  return minutes <= 1 ? 'a minute' : `${minutes} minutes`;
}

function makeSpawnButtonHandler(action) {
  return async (interaction, spawnId) => {
    const spawn = getSpawnById(spawnId);
    if (!spawn || spawn.resolved) {
      await interaction.reply({ embeds: [errorEmbed({ description: "🐀 This spawn's gone." })], ephemeral: true });
      return;
    }

    const remaining = getActionCooldownRemaining(interaction.guildId, interaction.user.id, action);
    if (remaining > 0) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 Give it ${formatCooldown(remaining)} before you do that again.` })], ephemeral: true });
      return;
    }

    const variant = VARIANTS[spawn.variant] ?? VARIANTS.normal;
    const isFirst = !getFirstInteractor(spawnId);
    const state = applyInteraction(interaction.guildId, spawnId, interaction.user.id, action, variant.multiplier);

    const replyPayload = {
      embeds: [successEmbed({ description: `🐀 ${interaction.user} ${ACTION_LABELS[action]}.${isFirst ? ' First to help out today!' : ''}` })],
    };
    await interaction.reply(await applyMedia(replyPayload, getMediaForMoment(action)));

    const updatedSpawnPayload = await buildSpawnPayload(state, spawn);
    await interaction.message.edit(updatedSpawnPayload).catch(() => {});
  };
}

export const spawnButtons = {
  feed: makeSpawnButtonHandler('feed'),
  water: makeSpawnButtonHandler('water'),
  play: makeSpawnButtonHandler('play'),
  sleep: makeSpawnButtonHandler('sleep'),
  clean: makeSpawnButtonHandler('clean'),
};
