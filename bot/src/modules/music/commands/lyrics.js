import { SlashCommandBuilder } from 'discord.js';
import { getLavalinkManager } from '../../../lavalink/manager.js';
import { infoEmbed, errorEmbed, warnEmbed } from '../../../core/embeds.js';
import { fetchJson } from '../../../utils/httpJson.js';

const LRCLIB_BASE = 'https://lrclib.net/api';
const EMBED_DESCRIPTION_LIMIT = 4000;

// Bracketed noise YouTube titles carry that never appears in a lyrics DB.
const TITLE_NOISE = /[([](?:[^)\]]*?(?:official|lyric|video|audio|visuali[sz]er|hd|hq|4k|remaster(?:ed)?|explicit|clean|live|m\/v|mv)[^)\]]*)[)\]]/gi;

/**
 * Turns a playing track's metadata into a lyrics query. YouTube uploads are
 * usually titled "Artist - Song (Official Video)" by a channel named
 * "ArtistVEVO" or "Artist - Topic", so the title often holds the real
 * artist and the uploader name is just noise.
 */
export function cleanTrackForLyrics(title, author) {
  let track = String(title ?? '').replace(TITLE_NOISE, '').replace(/\s+(?:ft\.?|feat\.?)\s.*$/i, '').trim();
  let artist = String(author ?? '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/\s*(?:Official|Music)$/i, '')
    .trim();

  const dash = track.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dash) {
    artist = dash[1].trim();
    track = dash[2].trim();
  }

  return { track: track.replace(/^["“']|["”']$/g, '').trim(), artist };
}

async function searchLyrics(trackName, artistName) {
  const params = new URLSearchParams({ track_name: trackName, artist_name: artistName ?? '' });
  const results = await fetchJson(`${LRCLIB_BASE}/search?${params}`);
  const hit = results.find((r) => r.plainLyrics);
  if (hit || !artistName) return hit ?? null;

  // The artist guess is the shakiest part — retry on a free-text query before giving up.
  const loose = await fetchJson(`${LRCLIB_BASE}/search?${new URLSearchParams({ q: `${artistName} ${trackName}` })}`);
  return loose.find((r) => r.plainLyrics) ?? null;
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
      ({ track: trackName, artist: artistName } = cleanTrackForLyrics(current.info.title, current.info.author));
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
