import { SlashCommandBuilder } from 'discord.js';
import { getLavalinkManager } from '../../../lavalink/manager.js';
import { infoEmbed, errorEmbed, warnEmbed } from '../../../core/embeds.js';
import { fetchJson } from '../../../utils/httpJson.js';

const LRCLIB_BASE = 'https://lrclib.net/api';
const EMBED_DESCRIPTION_LIMIT = 4000;

async function searchLyrics(trackName, artistName) {
  const params = new URLSearchParams({ track_name: trackName, artist_name: artistName ?? '' });
  const results = await fetchJson(`${LRCLIB_BASE}/search?${params}`);
  return results.find((r) => r.plainLyrics) ?? null;
}

export const lyrics = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Fetch lyrics for the currently playing track.')
    .addStringOption((opt) => opt.setName('query').setDescription('Search a different song instead (title, or title - artist)')),

  async execute(interaction) {
    await interaction.deferReply();

    const query = interaction.options.getString('query');
    let trackName;
    let artistName;

    if (query) {
      const [title, artist] = query.split(' - ').map((s) => s.trim());
      trackName = title;
      artistName = artist ?? '';
    } else {
      const manager = getLavalinkManager();
      const player = manager.getPlayer(interaction.guildId);
      const current = player?.queue.current;
      if (!current) {
        await interaction.editReply({ embeds: [warnEmbed({ description: "🐀 Nothing's playing — give me a song with `/lyrics query:`." })] });
        return;
      }
      trackName = current.info.title;
      artistName = current.info.author;
    }

    try {
      const found = await searchLyrics(trackName, artistName);
      if (!found) {
        await interaction.editReply({ embeds: [errorEmbed({ description: `🐀 No lyrics found for **${trackName}**.` })] });
        return;
      }

      let text = found.plainLyrics.trim();
      let truncated = false;
      if (text.length > EMBED_DESCRIPTION_LIMIT) {
        text = `${text.slice(0, EMBED_DESCRIPTION_LIMIT)}…`;
        truncated = true;
      }

      await interaction.editReply({
        embeds: [
          infoEmbed({
            title: `📜 ${found.trackName} — ${found.artistName}`,
            description: truncated ? `${text}\n\n*(truncated — long song)*` : text,
          }),
        ],
      });
    } catch {
      await interaction.editReply({ embeds: [errorEmbed({ description: "🐀 Couldn't reach the lyrics database right now." })] });
    }
  },
};
