import { SlashCommandBuilder } from 'discord.js';
import { buildStatusBoardPayload } from '../ui/board.js';
import { listMonitors } from '../monitors.js';

export const status = {
  data: new SlashCommandBuilder().setName('status').setDescription('Overall status board — everything monitored, at a glance.'),

  async execute(interaction) {
    await interaction.reply(buildStatusBoardPayload(listMonitors(interaction.guildId)));
  },
};
