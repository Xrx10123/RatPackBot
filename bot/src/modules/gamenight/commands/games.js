import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed, errorEmbed, infoEmbed, warnEmbed } from '../../../core/embeds.js';
import { isManager } from '../../../core/permissions.js';
import { peachesName } from '../../../core/peachesVoice.js';
import { fuzzySearch } from '../../../utils/fuzzy.js';
import { componentText, escapeMarkdown } from '../../../utils/text.js';
import { listGames, getGame, addGame, findGameByName, removeGame, markPlayed, createPoll, getPoll, setPollMessage, saveVotes, closePoll } from '../store.js';
import { fitsPlayers, weightedPick, pickPollOptions, tallyPoll, playerRange } from '../logic.js';

const POLL_SIZE = 5;
const LETTERS = ['🇦', '🇧', '🇨', '🇩', '🇪'];
const unix = (ms) => Math.floor(ms / 1000);

/** How many people are hanging out in the caller's voice channel (humans only), or null. */
export function voiceHeadcount(member) {
  const channel = member?.voice?.channel;
  return channel ? channel.members.filter((m) => !m.user.bot).size : null;
}

function eligibleGames(guildId, players) {
  return listGames(guildId).filter((g) => fitsPlayers(g, players));
}

function describeGame(game) {
  const bits = [playerRange(game), game.lastPlayedAt ? `last played <t:${unix(game.lastPlayedAt)}:R>` : 'never played yet'].filter(Boolean);
  return bits.join(' · ');
}

export function buildPickPayload(guildId, game, players) {
  const name = peachesName(guildId);
  const embed = successEmbed({
    title: '🎲 What should we play?',
    description: [`${name} spins the cheese wheel… it lands on…`, '', `## ${escapeMarkdown(game.name)}`, describeGame(game), players ? `-# Picked for ${players} player${players === 1 ? '' : 's'}.` : null]
      .filter((l) => l !== null)
      .join('\n'),
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gamenight:reroll:${players ?? 0}:${game.id}`).setEmoji('🎲').setLabel('Reroll').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`gamenight:play:${game.id}`).setEmoji('✅').setLabel("Let's play!").setStyle(ButtonStyle.Success),
  );
  return { embeds: [embed], components: [row] };
}

export function buildPollPayload(poll, games, { closed = false, winnerIndex = null, tied = false, name = 'Peaches' } = {}) {
  const { tally } = tallyPoll(games.length, poll.votes);
  const total = tally.reduce((a, b) => a + b, 0);
  const lines = games.map((g, i) => {
    const bar = total ? '▰'.repeat(Math.round((tally[i] / total) * 10)).padEnd(10, '▱') : '▱'.repeat(10);
    const crown = closed && i === winnerIndex ? ' 👑' : '';
    return `${LETTERS[i]} **${escapeMarkdown(g.name)}**${crown}\n\`${bar}\` ${tally[i]} vote${tally[i] === 1 ? '' : 's'}`;
  });

  let footer;
  if (!closed) footer = `Voting closes <t:${unix(poll.endsAt)}:R>. Click again to change your vote.`;
  else if (winnerIndex == null) footer = `Nobody voted. ${name} is choosing to nap instead.`;
  else footer = `🎮 **${escapeMarkdown(games[winnerIndex].name)}** it is!${tied ? ` (It was a tie — ${name} cast the deciding squeak.)` : ''}`;

  const embed = (closed ? successEmbed : infoEmbed)({ title: closed ? '🗳️ The votes are in!' : '🗳️ Game night vote', description: [...lines, '', footer].join('\n') });
  if (closed) return { embeds: [embed], components: [] };

  const voteRow = new ActionRowBuilder().addComponents(
    games.map((g, i) => new ButtonBuilder().setCustomId(`gamenight:vote:${poll.id}:${i}`).setEmoji(LETTERS[i]).setLabel(componentText(g.name, 'Game', 40)).setStyle(ButtonStyle.Primary)),
  );
  const endRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gamenight:vote_end:${poll.id}`).setEmoji('🏁').setLabel('End vote now').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [voteRow, endRow] };
}

export const games = {
  data: new SlashCommandBuilder()
    .setName('games')
    .setDescription('Game night: the group\'s game list, a random pick, or a vote.')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a game to the list.')
        .addStringOption((o) => o.setName('name').setDescription('Game name').setRequired(true).setMaxLength(80))
        .addIntegerOption((o) => o.setName('min_players').setDescription('Fewest players it works with').setMinValue(1).setMaxValue(100))
        .addIntegerOption((o) => o.setName('max_players').setDescription('Most players it works with').setMinValue(1).setMaxValue(100)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Take a game off the list.')
        .addStringOption((o) => o.setName('game').setDescription('Which game').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Everything on the list.'))
    .addSubcommand((sub) =>
      sub
        .setName('pick')
        .setDescription('Peaches picks something to play.')
        .addIntegerOption((o) => o.setName('players').setDescription('How many are playing (default: everyone in your voice channel)').setMinValue(1).setMaxValue(100)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('vote')
        .setDescription('Quick vote between a few games.')
        .addIntegerOption((o) => o.setName('players').setDescription('How many are playing (default: your voice channel)').setMinValue(1).setMaxValue(100))
        .addIntegerOption((o) => o.setName('minutes').setDescription('How long voting stays open (default 3)').setMinValue(1).setMaxValue(60)),
    ),

  async autocomplete(interaction) {
    const typed = interaction.options.getFocused();
    const matches = fuzzySearch(typed, listGames(interaction.guildId), { key: (g) => g.name, limit: 25 });
    await interaction.respond(matches.map((g) => ({ name: componentText(g.name), value: g.id })));
  },

  async execute(interaction) {
    await SUBCOMMANDS[interaction.options.getSubcommand()](interaction);
  },
};

const SUBCOMMANDS = {
  async add(interaction) {
    const name = interaction.options.getString('name', true).trim();
    let min = interaction.options.getInteger('min_players');
    let max = interaction.options.getInteger('max_players');
    if (min != null && max != null && min > max) [min, max] = [max, min];
    if (!name) {
      await interaction.reply({ embeds: [errorEmbed({ description: '🐀 Give the game a name.' })], ephemeral: true });
      return;
    }
    const row = addGame({ guildId: interaction.guildId, name, minPlayers: min, maxPlayers: max, addedBy: interaction.user.id });
    if (!row) {
      await interaction.reply({ embeds: [warnEmbed({ description: `🎮 **${escapeMarkdown(findGameByName(interaction.guildId, name)?.name ?? name)}** is already on the list.` })], ephemeral: true });
      return;
    }
    const range = playerRange(row);
    await interaction.reply({ embeds: [successEmbed({ description: `🎮 Added **${escapeMarkdown(row.name)}**${range ? ` (${range})` : ''} to the game night list.` })] });
  },

  async remove(interaction) {
    const value = interaction.options.getString('game', true);
    const game = getGame(value)?.guildId === interaction.guildId ? getGame(value) : findGameByName(interaction.guildId, value);
    if (!game) {
      await interaction.reply({ embeds: [errorEmbed({ description: '🐀 That game isn\'t on the list.' })], ephemeral: true });
      return;
    }
    if (game.addedBy !== interaction.user.id && !isManager(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed({ description: `🐀 Only <@${game.addedBy}> (who added it) or a server manager can remove that one.` })], ephemeral: true });
      return;
    }
    removeGame(interaction.guildId, game.id);
    await interaction.reply({ embeds: [successEmbed({ description: `🎮 Took **${escapeMarkdown(game.name)}** off the list.` })], ephemeral: true });
  },

  async list(interaction) {
    const all = listGames(interaction.guildId);
    if (all.length === 0) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🎮 The list is empty — add your go-to games with `/games add`.' })], ephemeral: true });
      return;
    }
    const lines = all.map((g) => `• **${escapeMarkdown(g.name)}** — ${describeGame(g)}`);
    let description = '';
    for (const [i, line] of lines.entries()) {
      if (description.length + line.length > 3900) {
        description += `\n…and ${lines.length - i} more`;
        break;
      }
      description += `${description ? '\n' : ''}${line}`;
    }
    await interaction.reply({ embeds: [infoEmbed({ title: `🎮 Game night list (${all.length})`, description })] });
  },

  async pick(interaction) {
    const players = interaction.options.getInteger('players') ?? voiceHeadcount(interaction.member);
    const pool = eligibleGames(interaction.guildId, players);
    if (pool.length === 0) {
      const why = listGames(interaction.guildId).length === 0 ? 'The list is empty — add some games with `/games add` first.' : `Nothing on the list works for ${players} players.`;
      await interaction.reply({ embeds: [warnEmbed({ description: `🐀 ${why}` })], ephemeral: true });
      return;
    }
    await interaction.reply(buildPickPayload(interaction.guildId, weightedPick(pool), players));
  },

  async vote(interaction) {
    const players = interaction.options.getInteger('players') ?? voiceHeadcount(interaction.member);
    const pool = eligibleGames(interaction.guildId, players);
    if (pool.length < 2) {
      await interaction.reply({ embeds: [warnEmbed({ description: '🐀 I need at least two games that fit to hold a vote — add more with `/games add`.' })], ephemeral: true });
      return;
    }
    const options = pickPollOptions(pool, POLL_SIZE);
    const minutes = interaction.options.getInteger('minutes') ?? 3;
    const poll = createPoll({ guildId: interaction.guildId, channelId: interaction.channelId, createdBy: interaction.user.id, options: options.map((g) => g.id), durationMs: minutes * 60_000 });
    await interaction.reply(buildPollPayload(poll, options));
    const message = await interaction.fetchReply();
    setPollMessage(poll.id, message.id);
    setTimeout(() => finishPoll(interaction.client, poll.id).catch(() => {}), minutes * 60_000).unref?.();
  },
};

function pollGames(poll) {
  return poll.options.map((id) => getGame(id) ?? { id, name: '(removed game)' });
}

/** Closes a poll and announces the winner. Safe to call from the timer, the button and the sweep. */
export async function finishPoll(client, pollId, { random = Math.random } = {}) {
  const poll = getPoll(pollId);
  if (!poll || !closePoll(poll.id)) return null;
  const options = pollGames(poll);
  const { index, tied } = tallyPoll(options.length, poll.votes, random);
  if (index != null && options[index].guildId) markPlayed(options[index].id);

  const channel = await client.channels.fetch(poll.channelId).catch(() => null);
  const message = poll.messageId ? await channel?.messages?.fetch(poll.messageId).catch(() => null) : null;
  await message?.edit(buildPollPayload(poll, options, { closed: true, winnerIndex: index, tied, name: peachesName(poll.guildId) })).catch(() => {});
  return index == null ? null : options[index];
}

export const gameButtons = {
  async reroll(interaction, playersStr, currentId) {
    const players = Number(playersStr) || null;
    const pool = eligibleGames(interaction.guildId, players);
    const game = weightedPick(pool, { exclude: currentId });
    if (!game) {
      await interaction.reply({ embeds: [warnEmbed({ description: '🐀 Nothing left on the list to pick.' })], ephemeral: true });
      return;
    }
    await interaction.update(buildPickPayload(interaction.guildId, game, players));
  },

  async play(interaction, gameId) {
    const game = getGame(gameId);
    if (!game || game.guildId !== interaction.guildId) {
      await interaction.reply({ embeds: [errorEmbed({ description: '🐀 That game isn\'t on the list any more.' })], ephemeral: true });
      return;
    }
    markPlayed(game.id);
    await interaction.update({
      embeds: [successEmbed({ title: '🎮 Game night!', description: `Tonight's game: **${escapeMarkdown(game.name)}**. ${peachesName(interaction.guildId)} has called dibs on player one.\n-# Locked in by ${interaction.user}.` })],
      components: [],
    });
  },

  async vote(interaction, pollId, indexStr) {
    const poll = getPoll(pollId);
    const index = Number(indexStr);
    if (!poll || poll.closed || poll.endsAt < Date.now() || !(index >= 0 && index < poll.options.length)) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🗳️ That vote has closed.' })], ephemeral: true });
      return;
    }
    poll.votes[interaction.user.id] = index;
    saveVotes(poll.id, poll.votes);
    await interaction.update(buildPollPayload(poll, pollGames(poll)));
  },

  async vote_end(interaction, pollId) {
    const poll = getPoll(pollId);
    if (!poll || poll.closed) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🗳️ Already closed.' })], ephemeral: true });
      return;
    }
    if (poll.createdBy !== interaction.user.id && !isManager(interaction.member)) {
      await interaction.reply({ embeds: [infoEmbed({ description: `🗳️ Only <@${poll.createdBy}> (who started it) can end it early.` })], ephemeral: true });
      return;
    }
    await interaction.deferUpdate();
    await finishPoll(interaction.client, poll.id);
  },
};
