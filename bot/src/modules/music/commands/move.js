import { SlashCommandBuilder } from 'discord.js';
import { requirePlayerInVoice } from '../guards.js';
import { successEmbed, errorEmbed } from '../../../core/embeds.js';
import { refreshPanel } from '../ui/panel.js';
import { queuePositionChoices } from '../ui/queueChoices.js';
import { escapeMarkdown } from '../../../utils/text.js';

export const move = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a queued track to a different position.')
    .addIntegerOption((opt) => opt.setName('from').setDescription('Track to move').setRequired(true).setMinValue(1).setAutocomplete(true))
    .addIntegerOption((opt) => opt.setName('to').setDescription('New position (1 = up next)').setRequired(true).setMinValue(1)),

  autocomplete: queuePositionChoices,

  async execute(interaction) {
    const { ok, player } = await requirePlayerInVoice(interaction);
    if (!ok) return;

    const length = player.queue.tracks.length;
    const from = interaction.options.getInteger('from', true);
    const to = Math.min(interaction.options.getInteger('to', true), length);
    const track = player.queue.tracks[from - 1];
    if (!track) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 There's no track #${from} — the queue has ${length}.` })], ephemeral: true });
      return;
    }

    if (from !== to) {
      await player.queue.splice(from - 1, 1);
      await player.queue.add(track, to - 1);
    }

    await interaction.reply({ embeds: [successEmbed({ description: `↕️ Moved **${escapeMarkdown(track.info.title)}** to position **${to}**.` })], ephemeral: true });
    await refreshPanel(interaction.client, player);
  },
};
