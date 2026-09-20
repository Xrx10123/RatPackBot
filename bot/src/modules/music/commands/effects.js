import { SlashCommandBuilder } from 'discord.js';
import { requirePlayerInVoice } from '../guards.js';
import { successEmbed } from '../../../core/embeds.js';

// Standard Lavalink bassboost curve — boosts the low bands, tapers toward mid/high.
const BASSBOOST_BANDS = [
  { band: 0, gain: 0.6 },
  { band: 1, gain: 0.5 },
  { band: 2, gain: 0.4 },
  { band: 3, gain: 0.3 },
  { band: 4, gain: 0.2 },
  { band: 5, gain: 0.1 },
];

const PRESETS = {
  bassboost: {
    label: 'Bassboost',
    apply: async (fm) => {
      await fm.setEQ(BASSBOOST_BANDS);
      return true;
    },
  },
  nightcore: { label: 'Nightcore', apply: (fm) => fm.toggleNightcore() },
  vaporwave: { label: 'Vaporwave', apply: (fm) => fm.toggleVaporwave() },
  '8d': { label: '8D', apply: (fm) => fm.toggleRotation() },
  karaoke: { label: 'Karaoke', apply: (fm) => fm.toggleKaraoke() },
  tremolo: { label: 'Tremolo', apply: (fm) => fm.toggleTremolo() },
  off: {
    label: 'Off',
    apply: async (fm) => {
      await fm.resetFilters();
      return false;
    },
  },
};

export const effects = {
  data: new SlashCommandBuilder()
    .setName('effects')
    .setDescription('Toggle an audio effect (the Sewer Effects).')
    .addStringOption((opt) =>
      opt
        .setName('preset')
        .setDescription('Effect to toggle')
        .setRequired(true)
        .addChoices(
          { name: 'Bassboost', value: 'bassboost' },
          { name: 'Nightcore', value: 'nightcore' },
          { name: 'Vaporwave', value: 'vaporwave' },
          { name: '8D', value: '8d' },
          { name: 'Karaoke', value: 'karaoke' },
          { name: 'Tremolo', value: 'tremolo' },
          { name: 'Off (clear all)', value: 'off' },
        ),
    ),

  async execute(interaction) {
    const { ok, player } = await requirePlayerInVoice(interaction);
    if (!ok) return;

    const presetKey = interaction.options.getString('preset', true);
    const preset = PRESETS[presetKey];

    const nowOn = await preset.apply(player.filterManager);
    const description =
      presetKey === 'off'
        ? '🧪 Cleared the pipes. All effects off.'
        : `🧪 ${preset.label} is now **${nowOn ? 'on' : 'off'}**.`;

    await interaction.reply({ embeds: [successEmbed({ description })], ephemeral: true });
  },
};
