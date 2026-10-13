import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed, infoEmbed, warnEmbed } from '../../../core/embeds.js';
import { isManager } from '../../../core/permissions.js';
import { getCurrentState } from '../state.js';
import { reward, CHEESE_REWARDS } from '../economy.js';
import { pickLine } from '../variants.js';
import { createGame, getActiveGame, getGame, saveGameData, resolveGame, setGameMessage, fetchGameMessage, later } from './store.js';

export const RACERS = [
  { name: 'Squeakers', emoji: '🐁' },
  { name: 'Nibbles', emoji: '🐀' },
  { name: 'Sir Whiskers', emoji: '🐹' },
  { name: 'Gouda Gary', emoji: '🐿️' },
];
export const LOBBY_MS = 60_000;
export const TRACK_LENGTH = 14;
const FRAME_MS = 1_600;

/**
 * Runs a whole race up front. Each tick every racer scurries 0–3 spaces
 * (0 = distracted by a crumb). Exactly one winner: if several cross the
 * line on the same tick, whoever overshoots furthest wins, then a coin flip.
 */
export function simulateRace({ racers = RACERS.length, track = TRACK_LENGTH, random = Math.random } = {}) {
  const positions = Array(racers).fill(0);
  const frames = [];
  while (Math.max(...positions) < track) {
    const steps = positions.map(() => Math.floor(random() * 4));
    steps.forEach((step, i) => (positions[i] += step));
    frames.push({ positions: [...positions], steps });
    if (frames.length > 200) break; // can't happen with these odds, but never loop forever
  }
  const best = Math.max(...positions);
  const leaders = positions.map((p, i) => [p, i]).filter(([p]) => p === best).map(([, i]) => i);
  const winner = leaders[Math.floor(random() * leaders.length)];
  return { frames, winner };
}

function lane(racer, position) {
  const pos = Math.min(position, TRACK_LENGTH);
  return `🏁${'·'.repeat(TRACK_LENGTH - pos)}${racer.emoji}${'·'.repeat(pos)} ${racer.name}`;
}

function commentary(frame, random = Math.random) {
  const lazy = frame.steps.findIndex((s) => s === 0);
  const zoom = frame.steps.indexOf(Math.max(...frame.steps));
  if (lazy >= 0 && random() < 0.6) return `${RACERS[lazy].name} stops to sniff a crumb!`;
  return pickLine([`${RACERS[zoom].name} puts on a burst of speed!`, `${RACERS[zoom].name} is flying!`, `What a scamper from ${RACERS[zoom].name}!`]);
}

function backersLine(bets) {
  return RACERS.map((r, i) => {
    const backers = Object.entries(bets).filter(([, pick]) => pick === i).map(([userId]) => `<@${userId}>`);
    return `${r.emoji} **${r.name}** — ${backers.length ? backers.join(' ') : '*no backers*'}`;
  }).join('\n');
}

export function buildLobbyPayload(game, name = 'Peaches') {
  const embed = infoEmbed({
    title: '🏁 The Great Rat Race!',
    description: [
      `${name} is hosting a race! Pick who you think will win.`,
      `Backers of the winner get **${CHEESE_REWARDS.raceWin} 🧀**, everyone who joins gets **${CHEESE_REWARDS.raceJoin} 🧀**. Nobody loses anything.`,
      '',
      backersLine(game.data.bets),
    ].join('\n'),
  });
  embed.setTimestamp(game.expiresAt);
  embed.setFooter({ text: '🐀 Race starts' });

  const picks = new ActionRowBuilder().addComponents(
    RACERS.map((r, i) => new ButtonBuilder().setCustomId(`peaches:race_pick:${game.id}:${i}`).setEmoji(r.emoji).setLabel(r.name).setStyle(ButtonStyle.Primary)),
  );
  const go = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`peaches:race_go:${game.id}`).setEmoji('🏁').setLabel('Start now (host)').setStyle(ButtonStyle.Success),
  );
  return { embeds: [embed], components: [picks, go] };
}

function racePayload(positions, line, title = '🏁 And they\'re off!') {
  const track = RACERS.map((r, i) => lane(r, positions[i])).join('\n');
  return { embeds: [infoEmbed({ title, description: `\`\`\`\n${track}\n\`\`\`\n${line}` })], components: [] };
}

export async function startRaceLobby(interaction) {
  const existing = getActiveGame(interaction.guildId, 'race');
  if (existing) {
    await interaction.reply({ embeds: [warnEmbed({ description: '🏁 A race is already lining up — pick a racer on that one!' })], ephemeral: true });
    return;
  }
  const game = createGame({
    guildId: interaction.guildId,
    type: 'race',
    channelId: interaction.channelId,
    durationMs: LOBBY_MS,
    data: { bets: {}, hostId: interaction.user.id },
  });
  const { name } = getCurrentState(interaction.guildId);
  await interaction.reply(buildLobbyPayload(game, name));
  const reply = await interaction.fetchReply();
  setGameMessage(game.id, reply.id);
  later(LOBBY_MS, () => runRace(interaction.client, game.id));
}

export async function pickRacer(interaction, gameId, indexStr) {
  const game = getGame(gameId);
  const index = Number(indexStr);
  if (!game || game.resolved || !RACERS[index]) {
    await interaction.reply({ embeds: [infoEmbed({ description: '🏁 Too late — the racers are already off!' })], ephemeral: true });
    return;
  }
  game.data.bets[interaction.user.id] = index;
  saveGameData(game.id, game.data);
  const { name } = getCurrentState(interaction.guildId);
  await interaction.update(buildLobbyPayload(game, name));
}

export async function startRaceNow(interaction, gameId) {
  const game = getGame(gameId);
  if (!game || game.resolved) {
    await interaction.reply({ embeds: [infoEmbed({ description: '🏁 That race already started.' })], ephemeral: true });
    return;
  }
  if (game.data.hostId !== interaction.user.id && !isManager(interaction.member)) {
    await interaction.reply({ embeds: [infoEmbed({ description: `🏁 Only <@${game.data.hostId}> (who started it) can fire the starting pistol early.` })], ephemeral: true });
    return;
  }
  await interaction.deferUpdate();
  await runRace(interaction.client, gameId);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Closes betting and plays the race out by editing the message frame by
 * frame. Safe to call from the lobby timer, the host's button and the
 * sweep at once: only the caller that resolves the game runs it.
 */
export async function runRace(client, gameId, { frameMs = FRAME_MS, random = Math.random } = {}) {
  const game = getGame(gameId);
  if (!game || !resolveGame(game.id)) return null;
  const message = await fetchGameMessage(client, game);
  const { name } = getCurrentState(game.guildId);
  const bettors = Object.entries(game.data.bets);

  if (bettors.length === 0) {
    await message?.edit({ embeds: [warnEmbed({ title: '🏁 Race called off', description: `Nobody picked a racer, so ${name} sent everyone home. The rats are relieved.` })], components: [] }).catch(() => {});
    return null;
  }

  const { frames, winner } = simulateRace({ random });
  for (const frame of frames) {
    await message?.edit(racePayload(frame.positions, commentary(frame, random))).catch(() => {});
    if (frameMs > 0) await sleep(frameMs);
  }

  const winners = bettors.filter(([, pick]) => pick === winner).map(([userId]) => userId);
  for (const [userId] of bettors) reward(game.guildId, userId, 'raceJoin');
  for (const userId of winners) reward(game.guildId, userId, 'raceWin');

  const champ = RACERS[winner];
  const result = [
    `🏆 **${champ.emoji} ${champ.name} wins!**`,
    winners.length ? `Cheese for the backers: ${winners.map((id) => `<@${id}>`).join(' ')} *(+${CHEESE_REWARDS.raceWin + CHEESE_REWARDS.raceJoin} 🧀 each)*` : `Nobody backed ${champ.name}. ${name} is smug about it.`,
    `Everyone else gets **${CHEESE_REWARDS.raceJoin} 🧀** for showing up.`,
  ].join('\n');
  const final = racePayload(frames.at(-1).positions, result, '🏁 Photo finish!');
  final.embeds = [successEmbed({ title: final.embeds[0].data.title, description: final.embeds[0].data.description })];
  await message?.edit(final).catch(() => {});
  return { winner, winners };
}
