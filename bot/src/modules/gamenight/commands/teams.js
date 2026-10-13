import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../../core/embeds.js';
import { peachesName } from '../../../core/peachesVoice.js';
import { splitTeams, TEAM_NAMES } from '../logic.js';

const MENTION = /<@!?(\d{15,25})>/g;
// Who was in each /teams message, for the reshuffle button. Short-lived on purpose.
const rosters = new Map(); // messageId -> { players, count, at }
const ROSTER_TTL_MS = 3 * 60 * 60 * 1000;

export function parseMentions(text) {
  return [...new Set([...String(text ?? '').matchAll(MENTION)].map((m) => m[1]))];
}

export function buildTeamsPayload(players, count, name = 'Peaches', random = Math.random) {
  const teams = splitTeams(players, count, random);
  const embed = successEmbed({
    title: '⚔️ Teams',
    description: [
      `${name} drew names out of a very small hat:`,
      '',
      ...teams.map((team, i) => `**${TEAM_NAMES[i]}**\n${team.map((id) => `<@${id}>`).join(' ') || '*nobody*'}`),
    ].join('\n'),
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gamenight:teams_shuffle:${count}`).setEmoji('🔀').setLabel('Reshuffle').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}

export const teams = {
  data: new SlashCommandBuilder()
    .setName('teams')
    .setDescription('Split people into random teams.')
    .addIntegerOption((o) => o.setName('count').setDescription('How many teams (default 2)').setMinValue(2).setMaxValue(TEAM_NAMES.length))
    .addStringOption((o) => o.setName('players').setDescription('@mention who\'s playing (default: everyone in your voice channel)').setMaxLength(1500)),

  async execute(interaction) {
    const count = interaction.options.getInteger('count') ?? 2;
    let players = parseMentions(interaction.options.getString('players'));
    if (players.length === 0) {
      const channel = interaction.member?.voice?.channel;
      players = channel ? [...channel.members.filter((m) => !m.user.bot).keys()] : [];
    }
    if (players.length < count) {
      const hint = players.length === 0 ? 'Join a voice channel with everyone, or @mention the players.' : `That's ${players.length} player${players.length === 1 ? '' : 's'} for ${count} teams.`;
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 Not enough people for ${count} teams. ${hint}` })], ephemeral: true });
      return;
    }
    await interaction.reply(buildTeamsPayload(players, count, peachesName(interaction.guildId)));
    const message = await interaction.fetchReply();
    rosters.set(message.id, { players, count, at: Date.now() });
    for (const [id, r] of rosters) if (Date.now() - r.at > ROSTER_TTL_MS) rosters.delete(id);
  },
};

export const teamButtons = {
  async teams_shuffle(interaction) {
    const roster = rosters.get(interaction.message?.id);
    if (!roster) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🔀 These teams are too old to reshuffle — run `/teams` again.' })], ephemeral: true });
      return;
    }
    await interaction.update(buildTeamsPayload(roster.players, roster.count, peachesName(interaction.guildId)));
  },
};
