import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { successEmbed, infoEmbed, errorEmbed, warnEmbed } from '../../core/embeds.js';
import { checkChannelPermissions, isManager } from '../../core/permissions.js';
import { peachesName, giftCheese } from '../../core/peachesVoice.js';
import { logger } from '../../core/logger.js';
import { componentText, escapeMarkdown } from '../../utils/text.js';
import { normalizeForMatch } from '../../utils/fuzzy.js';
import { getLavalinkManager } from '../../lavalink/manager.js';
import { ensureConnectedPlayer, blockedEmbed } from './playerLifecycle.js';
import { quizPool } from './plays.js';

export const ROUND_MS = 25_000;
const BETWEEN_ROUNDS_MS = 5_000;
export const CHEESE_PER_CORRECT = 3;
export const CHEESE_FOR_WINNER = 15;
const LETTERS = ['🇦', '🇧', '🇨', '🇩'];

const quizzes = new Map(); // guildId -> quiz state (in memory: a restart simply ends a quiz)

/** One entry per distinct song title, so two uploads of the same song can't both be options. */
export function dedupeByTitle(pool) {
  const seen = new Set();
  return pool.filter((row) => {
    const key = normalizeForMatch(row.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Builds one round: the answer plus three decoys, shuffled. Pure. */
export function buildRound(pool, used, random = Math.random) {
  const fresh = pool.filter((row) => !used.has(row.uri));
  if (fresh.length === 0 || pool.length < 4) return null;
  const answer = fresh[Math.floor(random() * fresh.length)];
  const decoys = [];
  const others = pool.filter((row) => row.uri !== answer.uri);
  while (decoys.length < 3 && others.length > 0) decoys.push(others.splice(Math.floor(random() * others.length), 1)[0]);
  const options = [answer, ...decoys];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { answer, options, correct: options.indexOf(answer) };
}

/** Where in the song to start the snippet: somewhere in the middle, never the very start or end. */
export function snippetStart(durationMs, random = Math.random) {
  const usable = Math.max(0, durationMs - ROUND_MS - 5_000);
  return Math.floor(Math.min(usable, durationMs * (0.2 + random() * 0.35)));
}

function optionLabel(row) {
  return `${row.title}${row.author ? ` — ${row.author}` : ''}`;
}

export function buildRoundPayload(quiz, { reveal = false, winnerId = null } = {}) {
  const { round, options, correct } = quiz.current;
  const lines = options.map((row, i) => `${LETTERS[i]} ${escapeMarkdown(optionLabel(row))}`);
  let footer;
  if (!reveal) footer = `🎧 Listen in <#${quiz.voiceChannelId}>! First right answer scores. One guess per round.`;
  else if (winnerId) footer = `🎉 <@${winnerId}> got it — **${escapeMarkdown(options[correct].title)}**!`;
  else footer = `⏰ Nobody got it! It was **${escapeMarkdown(options[correct].title)}**.`;

  const embed = (reveal ? (winnerId ? successEmbed : warnEmbed) : infoEmbed)({
    title: `🎶 Guess the song — round ${round}/${quiz.rounds}`,
    description: [...lines, '', footer].join('\n'),
  });
  if (!reveal) embed.setTimestamp(quiz.current.endsAt);

  const answers = new ActionRowBuilder().addComponents(
    options.map((row, i) =>
      new ButtonBuilder()
        .setCustomId(`music:quiz:${quiz.id}:${round}:${i}`)
        .setEmoji(LETTERS[i])
        .setLabel(componentText(row.title, 'Song', 40))
        .setStyle(reveal ? (i === correct ? ButtonStyle.Success : ButtonStyle.Secondary) : ButtonStyle.Primary)
        .setDisabled(reveal),
    ),
  );
  const end = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`music:quiz_end:${quiz.id}`).setEmoji('🛑').setLabel('End quiz').setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [answers, end], allowedMentions: { parse: [] } };
}

/** Final standings and cheese. Pure apart from the returned payout list. */
export function scoreboard(scores) {
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[1] ?? 0;
  const winners = top > 0 ? ranked.filter(([, s]) => s === top).map(([id]) => id) : [];
  const payouts = ranked.map(([userId, score]) => ({ userId, score, cheese: score * CHEESE_PER_CORRECT + (winners.includes(userId) ? CHEESE_FOR_WINNER : 0) }));
  return { ranked, winners, payouts };
}

async function editQuizMessage(quiz, payload) {
  await quiz.message?.edit(payload).catch((err) => logger.debug({ err }, 'Quiz message edit failed'));
}

async function nextRound(quiz) {
  if (quizzes.get(quiz.guildId) !== quiz) return; // ended in the meantime
  if (quiz.roundNumber >= quiz.rounds) return finishQuiz(quiz);

  // A song's link can die; try a few before giving up on the quiz.
  for (let attempt = 0; attempt < 5; attempt++) {
    const round = buildRound(quiz.pool, quiz.used, quiz.random);
    if (!round) break;
    quiz.used.add(round.answer.uri);
    const result = await quiz.player.search({ query: round.answer.uri }, 'Guess the song').catch(() => null);
    const track = result?.tracks?.[0];
    if (!track || track.info.isStream) continue;

    quiz.roundNumber += 1;
    quiz.current = { ...round, round: quiz.roundNumber, answered: false, lockedOut: new Set(), endsAt: Date.now() + ROUND_MS };
    await quiz.player.play({ clientTrack: track, position: snippetStart(track.info.duration, quiz.random) });
    await editQuizMessage(quiz, buildRoundPayload(quiz));
    const roundRef = quiz.current;
    quiz.timer = setTimeout(() => revealRound(quiz, roundRef, null), ROUND_MS);
    quiz.timer.unref?.();
    return;
  }
  return finishQuiz(quiz, "I couldn't load enough songs to keep going.");
}

async function revealRound(quiz, round, winnerId) {
  if (quiz.current !== round || round.answered) return;
  round.answered = true;
  clearTimeout(quiz.timer);
  await editQuizMessage(quiz, buildRoundPayload(quiz, { reveal: true, winnerId }));
  quiz.timer = setTimeout(() => nextRound(quiz).catch((err) => logger.warn({ err }, 'Quiz round failed')), BETWEEN_ROUNDS_MS);
  quiz.timer.unref?.();
}

async function finishQuiz(quiz, note = null) {
  if (quizzes.get(quiz.guildId) !== quiz) return;
  quizzes.delete(quiz.guildId);
  clearTimeout(quiz.timer);
  await quiz.player.stopPlaying(true).catch(() => {});
  quiz.player.set('quiz', false);

  const { ranked, winners, payouts } = scoreboard(quiz.scores);
  for (const { userId, cheese } of payouts) if (cheese > 0) giftCheese(quiz.guildId, userId, cheese);
  const name = peachesName(quiz.guildId);
  const lines = ranked.length
    ? ranked.map(([id, score], i) => `${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`} <@${id}> — **${score}** point${score === 1 ? '' : 's'} *(+${payouts[i].cheese} 🧀)*`)
    : [`Nobody scored! ${name} is deeply unimpressed with everyone's taste.`];
  if (winners.length) lines.push('', `🏆 ${winners.map((id) => `<@${id}>`).join(' & ')} ${winners.length > 1 ? 'share' : 'takes'} the crown!`);
  if (note) lines.push('', `-# ${note}`);
  await editQuizMessage(quiz, { embeds: [successEmbed({ title: '🎶 Guess the song — final scores', description: lines.join('\n') })], components: [], allowedMentions: { parse: [] } });
}

/** Ends any quiz in this guild (e.g. the player was destroyed). */
export async function endQuizForGuild(guildId, note) {
  const quiz = quizzes.get(guildId);
  if (quiz) await finishQuiz(quiz, note);
}

export function getQuiz(guildId) {
  return quizzes.get(guildId) ?? null;
}

export const musicquiz = {
  data: new SlashCommandBuilder()
    .setName('musicquiz')
    .setDescription('Guess the song! Snippets from what this server listens to.')
    .addIntegerOption((o) => o.setName('rounds').setDescription('How many songs (default 5)').setMinValue(3).setMaxValue(10)),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) {
      await interaction.reply({ embeds: [errorEmbed({ description: '🐀 Hop into a voice channel first — the quiz plays there.' })], ephemeral: true });
      return;
    }
    const permCheck = checkChannelPermissions(voiceChannel, ['Connect', 'Speak']);
    if (!permCheck.ok) {
      await interaction.reply({ embeds: [permCheck.embed], ephemeral: true });
      return;
    }
    if (quizzes.has(interaction.guildId)) {
      await interaction.reply({ embeds: [warnEmbed({ description: '🎶 A quiz is already going!' })], ephemeral: true });
      return;
    }
    const existing = getLavalinkManager().getPlayer(interaction.guildId);
    if (existing?.queue.current || existing?.queue.tracks.length) {
      await interaction.reply({ embeds: [warnEmbed({ description: '🎶 Music is playing — let the queue finish (or `/stop`) before starting a quiz.' })], ephemeral: true });
      return;
    }

    const pool = dedupeByTitle(quizPool(interaction.guildId));
    if (pool.length < 4) {
      await interaction.reply({
        embeds: [infoEmbed({ description: `🎶 I need to have heard at least **4 different songs** in this server first (I've got ${pool.length}). Play some music and try again!` })],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    const connection = await ensureConnectedPlayer(interaction.guildId, voiceChannel);
    if (!connection.player) {
      await interaction.editReply({ embeds: [blockedEmbed(connection)] });
      return;
    }

    const quiz = {
      id: randomUUID().slice(0, 8),
      guildId: interaction.guildId,
      voiceChannelId: voiceChannel.id,
      startedBy: interaction.user.id,
      rounds: Math.min(interaction.options.getInteger('rounds') ?? 5, pool.length),
      roundNumber: 0,
      pool,
      used: new Set(),
      scores: new Map(),
      player: connection.player,
      random: Math.random,
      current: null,
      timer: null,
      message: null,
    };
    connection.player.set('quiz', true);
    quizzes.set(interaction.guildId, quiz);

    await interaction.editReply({ embeds: [infoEmbed({ title: '🎶 Guess the song!', description: `${peachesName(interaction.guildId)} is cueing up ${quiz.rounds} songs from this server's playlist… get ready!` })] });
    quiz.message = await interaction.fetchReply();
    setTimeout(() => nextRound(quiz).catch((err) => logger.warn({ err }, 'Quiz failed to start')), 3_000).unref?.();
  },
};

export const quizButtons = {
  async quiz(interaction, quizId, roundStr, indexStr) {
    const quiz = quizzes.get(interaction.guildId);
    const round = quiz?.current;
    if (!quiz || quiz.id !== quizId || !round || round.round !== Number(roundStr) || round.answered) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🎶 That round is over.' })], ephemeral: true });
      return;
    }
    if (round.lockedOut.has(interaction.user.id)) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🙊 One guess per round!' })], ephemeral: true });
      return;
    }
    if (Number(indexStr) !== round.correct) {
      round.lockedOut.add(interaction.user.id);
      await interaction.reply({ embeds: [warnEmbed({ description: '❌ Nope! Keep listening…' })], ephemeral: true });
      return;
    }
    quiz.scores.set(interaction.user.id, (quiz.scores.get(interaction.user.id) ?? 0) + 1);
    await interaction.deferUpdate();
    await revealRound(quiz, round, interaction.user.id);
  },

  async quiz_end(interaction, quizId) {
    const quiz = quizzes.get(interaction.guildId);
    if (!quiz || quiz.id !== quizId) {
      await interaction.reply({ embeds: [infoEmbed({ description: '🎶 That quiz is already over.' })], ephemeral: true });
      return;
    }
    if (quiz.startedBy !== interaction.user.id && !isManager(interaction.member)) {
      await interaction.reply({ embeds: [infoEmbed({ description: `🛑 Only <@${quiz.startedBy}> (who started it) can end the quiz early.` })], ephemeral: true });
      return;
    }
    await interaction.deferUpdate();
    await finishQuiz(quiz, `Ended early by ${interaction.user.username}.`);
  },
};

/** Test hook: register a quiz without going through Discord. */
export function _registerQuizForTests(quiz) {
  quizzes.set(quiz.guildId, quiz);
  return quiz;
}
export { nextRound as _nextRoundForTests };
