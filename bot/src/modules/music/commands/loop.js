import { SlashCommandBuilder } from 'discord.js';
import { requirePlayerInVoice } from '../guards.js';
import { successEmbed } from '../../../core/embeds.js';

const LOOP_LABELS = { off: 'Off', track: 'Track', queue: 'Queue' };

export const loop = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the loop mode.')
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('off, track, or queue')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' },
        ),
    ),

  async execute(interaction) {
    const { ok, player } = await requirePlayerInVoice(interaction);
    if (!ok) return;

    const mode = interaction.options.getString('mode', true);
    await player.setRepeatMode(mode);
    await interaction.reply({ embeds: [successEmbed({ description: `🔁 Loop set to **${LOOP_LABELS[mode]}**.` })], ephemeral: true });
  },
};
