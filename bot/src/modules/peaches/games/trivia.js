import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed, infoEmbed, warnEmbed } from '../../../core/embeds.js';
import { getCurrentState } from '../state.js';
import { reward, CHEESE_REWARDS } from '../economy.js';
import { TRIVIA } from './triviaQuestions.js';
import { createGame, getActiveGame, getGame, saveGameData, resolveGame, setGameMessage, fetchGameMessage, later } from './store.js';

export const TRIVIA_DURATION_MS = 45_000;
const LETTERS = ['🇦', '🇧', '🇨', '🇩'];

/** Fisher–Yates over answer indexes; returns the shuffled order and where the correct answer (index 0) landed. */
export function shuffleAnswers(count, random = Math.random) {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { order, correctSlot: order.indexOf(0) };
}

/** Avoid repeating any of the last few questions this server saw. */
function pickQuestion(recent = []) {
  const fresh = TRIVIA.map((_, i) => i).filter((i) => !recent.includes(i));
  const pool = fresh.length > 0 ? fresh : TRIVIA.map((_, i) => i);
  return pool[Math.floor(Math.random() * pool.length)];
}

const recentByGuild = new Map(); // guildId -> last ~15 question indexes (in-memory is fine; it's just variety)

export function buildTriviaPayload(game, { reveal = false, winnerId = null, name = 'Peaches' } = {}) {
  const question = TRIVIA[game.data.questionIndex];
  const answers = game.data.order.map((i) => question.a[i]);
  const lines = [`**${question.q}**`, '', ...answers.map((a, slot) => `${LETTERS[slot]} ${a}`)];

  let embed;
  if (!reveal) {
    lines.push('', `First correct answer wins **${CHEESE_REWARDS.trivia} 🧀**. One guess each!`);
    embed = infoEmbed({ title: `🧀 ${name}'s Cheese Trivia`, description: lines.join('\n') });
    embed.setTimestamp(game.expiresAt);
    embed.setFooter({ text: '🐀 Time runs out' });
  } else {
    const correct = answers[game.data.correctSlot];
    lines.push('', winnerId ? `🎉 <@${winnerId}> got it — **${correct}**! *(+${CHEESE_REWARDS.trivia} 🧀)*` : `⏰ Time's up! It was **${correct}**. ${name} is disappointed in all of you.`);
    embed = (winnerId ? successEmbed : warnEmbed)({ title: `🧀 ${name}'s Cheese Trivia`, description: lines.join('\n') });
  }

  const row = new ActionRowBuilder().addComponents(
    answers.map((_, slot) =>
      new ButtonBuilder()
        .setCustomId(`peaches:trivia:${game.id}:${slot}`)
        .setEmoji(LETTERS[slot])
        .setStyle(reveal ? (slot === game.data.correctSlot ? ButtonStyle.Success : ButtonStyle.Secondary) : ButtonStyle.Primary)
        .setDisabled(reveal),
    ),
  );
  return { embeds: [embed], components: [row] };
}

export async function startTrivia(interaction) {
  const existing = getActiveGame(interaction.guildId, 'trivia');
  if (existing && existing.expiresAt > Date.now()) {
    await interaction.reply({ embeds: [warnEmbed({ description: '🧀 There\'s already a question going — answer that one first!' })], ephemeral: true });
    return;
  }
  if (existing) await endTrivia(interaction.client, existing.id, existing); // expired but not swept yet

  const recent = recentByGuild.get(interaction.guildId) ?? [];
  const questionIndex = pickQuestion(recent);
  recentByGuild.set(interaction.guildId, [...recent, questionIndex].slice(-15));
  const { order, correctSlot } = shuffleAnswers(TRIVIA[questionIndex].a.length);

  const game = createGame({
    guildId: interaction.guildId,
    type: 'trivia',
    channelId: interaction.channelId,
    durationMs: TRIVIA_DURATION_MS,
    data: { questionIndex, order, correctSlot, wrong: [] },
  });
  const { name } = getCurrentState(interaction.guildId);
  await interaction.reply(buildTriviaPayload(game, { name }));
  const reply = await interaction.fetchReply();
  setGameMessage(game.id, reply.id);
  later(TRIVIA_DURATION_MS, () => endTrivia(interaction.client, game.id));
}

export async function answerTrivia(interaction, gameId, slotStr) {
  const game = getGame(gameId);
  const { name } = getCurrentState(interaction.guildId);
  if (!game || game.resolved || game.expiresAt < Date.now()) {
    await interaction.reply({ embeds: [infoEmbed({ description: '⏰ Too late — that question is over.' })], ephemeral: true });
    return;
  }
  if (game.data.wrong.includes(interaction.user.id)) {
    await interaction.reply({ embeds: [infoEmbed({ description: '🙊 You already guessed on this one. Let someone else have a go!' })], ephemeral: true });
    return;
  }

  if (Number(slotStr) !== game.data.correctSlot) {
    game.data.wrong.push(interaction.user.id);
    saveGameData(game.id, game.data);
    await interaction.reply({ embeds: [warnEmbed({ description: `❌ Nope! ${name} shakes her tiny head.` })], ephemeral: true });
    return;
  }

  if (!resolveGame(game.id, interaction.user.id)) {
    await interaction.reply({ embeds: [infoEmbed({ description: '🐀 Right answer — but someone beat you to it by a whisker!' })], ephemeral: true });
    return;
  }
  reward(interaction.guildId, interaction.user.id, 'trivia');
  await interaction.update(buildTriviaPayload(game, { reveal: true, winnerId: interaction.user.id, name }));
}

/** Time's up: reveal the answer. No-op if someone already won. */
export async function endTrivia(client, gameId, game = null) {
  const current = game ?? getGame(gameId);
  if (!current || !resolveGame(current.id)) return;
  const { name } = getCurrentState(current.guildId);
  const message = await fetchGameMessage(client, current);
  await message?.edit(buildTriviaPayload(current, { reveal: true, name })).catch(() => {});
}
