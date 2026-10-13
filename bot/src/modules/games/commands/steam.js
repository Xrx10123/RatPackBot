import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed, errorEmbed } from '../../../core/embeds.js';
import { config } from '../../../config.js';
import * as steam from '../providers/steam.js';

const STATE_LABELS = { 0: 'Offline', 1: 'Online', 2: 'Busy', 3: 'Away', 4: 'Snooze', 5: 'Looking to trade', 6: 'Looking to play' };

/**
 * Accepts what people actually paste: a SteamID64, a vanity name, or a full
 * profile URL (steamcommunity.com/id/<vanity> or /profiles/<id64>).
 * Returns { steamId } or { vanity }.
 */
export function parseSteamInput(raw) {
  const input = String(raw ?? '').trim();
  const url = input.match(/steamcommunity\.com\/(id|profiles)\/([^/?#\s]+)/i);
  if (url) return url[1].toLowerCase() === 'profiles' ? { steamId: url[2] } : { vanity: url[2] };
  if (/^\d{17}$/.test(input)) return { steamId: input };
  return { vanity: input };
}

/** Shared by /steam and its refresh button. */
export async function buildSteamPayload(input) {
  if (!config.steam.apiKey) {
    return { embeds: [errorEmbed({ description: '🐀 Steam lookups need `STEAM_API_KEY` set in `.env`.' })] };
  }

  try {
    const parsed = parseSteamInput(input);
    const steamId = parsed.steamId ?? (await steam.resolveVanityUrl(parsed.vanity));
    if (!steamId) {
      return { embeds: [errorEmbed({ description: `🐀 Couldn't find a Steam profile for **${input.slice(0, 100)}**.` })] };
    }

    const player = await steam.getPlayerSummary(steamId);
    if (!player) {
      return { embeds: [errorEmbed({ description: `🐀 Couldn't find a Steam profile for **${input}**.` })] };
    }

    const lines = [`Status: **${STATE_LABELS[player.personastate] ?? 'Unknown'}**`];
    if (player.gameextrainfo) lines.push(`🎮 Playing **${player.gameextrainfo}**`);

    const embed = successEmbed({
      title: player.personaname || 'Steam profile',
      description: `${lines.join('\n')}\n\n[Steam Profile](${player.profileurl})`,
      thumbnail: player.avatarfull,
    });
    embed.setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      // The resolved 17-digit id, never the raw input — user text can blow
      // past Discord's 100-char customId limit (which used to throw and get
      // misreported as "Couldn't reach Steam").
      new ButtonBuilder().setCustomId(`games:steam_refresh:${player.steamid ?? steamId}`).setEmoji('🔄').setLabel('Refresh').setStyle(ButtonStyle.Secondary),
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
    .addStringOption((opt) => opt.setName('steamid').setDescription('SteamID64, vanity name, or profile URL').setRequired(true).setMaxLength(200)),

  async execute(interaction) {
    await interaction.deferReply();
    const input = interaction.options.getString('steamid', true).trim();
    await interaction.editReply(await buildSteamPayload(input));
  },
};
