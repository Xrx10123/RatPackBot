import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed } from '../../../core/embeds.js';
import { config } from '../../../config.js';
import * as steam from '../providers/steam.js';

const STATE_LABELS = { 0: 'Offline', 1: 'Online', 2: 'Busy', 3: 'Away', 4: 'Snooze', 5: 'Looking to trade', 6: 'Looking to play' };

export const steamCommand = {
  data: new SlashCommandBuilder()
    .setName('steam')
    .setDescription('Look up a Steam profile.')
    .addStringOption((opt) => opt.setName('steamid').setDescription('SteamID64 or custom vanity URL name').setRequired(true)),

  async execute(interaction) {
    if (!config.steam.apiKey) {
      await interaction.reply({ embeds: [errorEmbed({ description: '🐀 Steam lookups need `STEAM_API_KEY` set in `.env`.' })], ephemeral: true });
      return;
    }

    await interaction.deferReply();
    const input = interaction.options.getString('steamid', true).trim();

    try {
      const steamId = /^\d{17}$/.test(input) ? input : await steam.resolveVanityUrl(input);
      if (!steamId) {
        await interaction.editReply({ embeds: [errorEmbed({ description: `🐀 Couldn't find a Steam profile for **${input}**.` })] });
        return;
      }

      const player = await steam.getPlayerSummary(steamId);
      if (!player) {
        await interaction.editReply({ embeds: [errorEmbed({ description: `🐀 Couldn't find a Steam profile for **${input}**.` })] });
        return;
      }

      const lines = [`Status: **${STATE_LABELS[player.personastate] ?? 'Unknown'}**`];
      if (player.gameextrainfo) lines.push(`🎮 Playing **${player.gameextrainfo}**`);

      await interaction.editReply({
        embeds: [
          successEmbed({
            title: player.personaname,
            description: `${lines.join('\n')}\n\n[Steam Profile](${player.profileurl})`,
            thumbnail: player.avatarfull,
          }),
        ],
      });
    } catch {
      await interaction.editReply({ embeds: [errorEmbed({ description: "🐀 Couldn't reach Steam right now." })] });
    }
  },
};
