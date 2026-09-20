import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, infoEmbed } from '../../../core/embeds.js';
import { updateGuildConfig, getGuildConfig } from '../../../core/guildConfig.js';

export const musicconfig = {
  data: new SlashCommandBuilder()
    .setName('musicconfig')
    .setDescription('Configure DJ role, vote-skip threshold, and 24/7 mode.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('status').setDescription('Show current music settings.'))
    .addSubcommand((sub) =>
      sub
        .setName('djrole')
        .setDescription('Set the role that can force-skip and bypass voting.')
        .addRoleOption((o) => o.setName('role').setDescription('DJ role (omit to clear)')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('voteskip')
        .setDescription('Set the vote-skip threshold.')
        .addIntegerOption((o) => o.setName('percent').setDescription('0-100').setRequired(true).setMinValue(1).setMaxValue(100)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('247')
        .setDescription('Toggle 24/7 mode (stay connected even when the channel empties).')
        .addBooleanOption((o) => o.setName('enabled').setDescription('On or off').setRequired(true)),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await SUBCOMMAND_HANDLERS[sub](interaction);
  },
};

const SUBCOMMAND_HANDLERS = {
  async status(interaction) {
    const config = getGuildConfig(interaction.guildId);
    await interaction.reply({
      embeds: [
        infoEmbed({
          title: '🎵 Music Settings',
          description: [
            `DJ role: ${config?.djRoleId ? `<@&${config.djRoleId}>` : '*none*'}`,
            `Vote-skip threshold: **${config?.voteSkipThreshold ?? 50}%**`,
            `24/7 mode: **${config?.twentyFourSeven ? 'on' : 'off'}**`,
          ].join('\n'),
        }),
      ],
      ephemeral: true,
    });
  },

  async djrole(interaction) {
    const role = interaction.options.getRole('role');
    updateGuildConfig(interaction.guildId, { djRoleId: role?.id ?? null });
    await interaction.reply({
      embeds: [successEmbed({ description: role ? `🎧 DJ role set to <@&${role.id}>.` : '🎧 DJ role cleared.' })],
      ephemeral: true,
    });
  },

  async voteskip(interaction) {
    const percent = interaction.options.getInteger('percent', true);
    updateGuildConfig(interaction.guildId, { voteSkipThreshold: percent });
    await interaction.reply({ embeds: [successEmbed({ description: `🗳 Vote-skip threshold set to **${percent}%**.` })], ephemeral: true });
  },

  async '247'(interaction) {
    const enabled = interaction.options.getBoolean('enabled', true);
    updateGuildConfig(interaction.guildId, { twentyFourSeven: enabled ? 1 : 0 });
    await interaction.reply({ embeds: [successEmbed({ description: `♾ 24/7 mode is now **${enabled ? 'on' : 'off'}**.` })], ephemeral: true });
  },
};
