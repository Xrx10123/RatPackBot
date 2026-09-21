import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed, errorEmbed } from '../../../core/embeds.js';
import { config } from '../../../config.js';
import * as steam from '../providers/steam.js';

const STATE_LABELS = { 0: 'Offline', 1: 'Online', 2: 'Busy', 3: 'Away', 4: 'Snooze', 5: 'Looking to trade', 6: 'Looking to play' };

/** Shared by /steam and its refresh button. */
export async function buildSteamPayload(input) {
  if (!config.steam.apiKey) {
    return { embeds: [errorEmbed({ description: '🐀 Steam lookups need `STEAM_API_KEY` set in `.env`.' })] };
  }

  try {
    const steamId = /^\d{17}$/.test(input) ? input : await steam.resolveVanityUrl(input);
    if (!steamId) {
      return { embeds: [errorEmbed({ description: `🐀 Couldn't find a Steam profile for **${input}**.` })] };
    }

    const player = await steam.getPlayerSummary(steamId);
    if (!player) {
      return { embeds: [errorEmbed({ description: `🐀 Couldn't find a Steam profile for **${input}**.` })] };
    }

    const lines = [`Status: **${STATE_LABELS[player.personastate] ?? 'Unknown'}**`];
    if (player.gameextrainfo) lines.push(`🎮 Playing **${player.gameextrainfo}**`);

    const embed = successEmbed({
      title: player.personaname,
      description: `${lines.join('\n')}\n\n[Steam Profile](${player.profileurl})`,
      thumbnail: player.avatarfull,
    });
    embed.setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`games:steam_refresh:${input}`).setEmoji('🔄').setLabel('Refresh').setStyle(ButtonStyle.Secondary),
    );

    return { embeds: [embed], components: [row] };
  } catch {
    return { embeds: [errorEmbed({ description: "🐀 Couldn't reach Steam right now." })] };
  }
}

export const steamCommand = {
  data: new SlashCommandBuilder()
    .setName('steam')
    .setDescription('Look up a Steam profile.')
    .addStringOption((opt) => opt.setName('steamid').setDescription('SteamID64 or custom vanity URL name').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();
    const input = interaction.options.getString('steamid', true).trim();
    await interaction.editReply(await buildSteamPayload(input));
  },
};
