import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { ensureGuildConfig, getGuildConfig } from '../guildConfig.js';
import { buildHubPayload } from '../ui/hub.js';
import { verifyGuildChannels, buildVerifyEmbed } from '../verify.js';

export const setup = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure Ratpack for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('start').setDescription('Open the setup panel.'))
    .addSubcommand((sub) => sub.setName('check').setDescription('Verify every configured channel.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'check') {
      const config = getGuildConfig(interaction.guildId);
      const results = await verifyGuildChannels(interaction.guild, config);
      await interaction.reply({ embeds: [buildVerifyEmbed(results)], ephemeral: true });
      return;
    }

    const config = ensureGuildConfig(interaction.guildId);
    await interaction.reply({ ...buildHubPayload(config), ephemeral: true });
  },
};
