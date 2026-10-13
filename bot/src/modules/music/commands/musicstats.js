import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../../../core/embeds.js';
import { peachesName } from '../../../core/peachesVoice.js';
import { escapeMarkdown } from '../../../utils/text.js';
import { getMusicStats, PERIODS } from '../plays.js';

const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.'];

export function formatListeningTime(ms) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} hour${hours === 1 ? '' : 's'}${rest ? ` ${rest} min` : ''}`;
}

export function buildStatsEmbed(stats, period, name = 'Peaches') {
  const label = PERIODS[period]?.label ?? 'all time';
  if (stats.plays === 0) {
    return infoEmbed({ title: `🎧 Rat Nest stats — ${label}`, description: `${name} hasn't heard anything ${period === 'all' ? 'yet' : label}. Put something on with \`/play\`!` });
  }
  const section = (title, rows, fmt) => (rows.length ? `**${title}**\n${rows.map((r, i) => `${MEDALS[i]} ${fmt(r)}`).join('\n')}` : null);
  const plays = (n) => `${n} play${Number(n) === 1 ? '' : 's'}`;
  return infoEmbed({
    title: `🎧 Rat Nest stats — ${label}`,
    description: [
      `**${stats.plays}** songs · **${formatListeningTime(stats.listenedMs)}** of music`,
      '',
      section('🎵 Most played', stats.topTracks, (t) => `${t.uri ? `[${escapeMarkdown(t.title)}](${t.uri})` : escapeMarkdown(t.title)} — ${plays(t.plays)}`),
      section('🎤 Top artists', stats.topArtists, (a) => `${escapeMarkdown(a.author)} — ${plays(a.plays)}`),
      section('🎧 Top DJs', stats.topDJs, (d) => `<@${d.userId}> — ${d.plays} request${Number(d.plays) === 1 ? '' : 's'}`),
    ]
      .filter((l) => l !== null)
      .join('\n\n')
      .slice(0, 4000),
  });
}

export const musicstats = {
  data: new SlashCommandBuilder()
    .setName('musicstats')
    .setDescription("What this server has been listening to.")
    .addStringOption((o) =>
      o
        .setName('period')
        .setDescription('Time range (default: this month)')
        .addChoices({ name: 'This week', value: 'week' }, { name: 'This month', value: 'month' }, { name: 'All time', value: 'all' }),
    ),

  async execute(interaction) {
    const period = interaction.options.getString('period') ?? 'month';
    const stats = getMusicStats(interaction.guildId, period);
    await interaction.reply({ embeds: [buildStatsEmbed(stats, period, peachesName(interaction.guildId))], allowedMentions: { parse: [] } });
  },
};
