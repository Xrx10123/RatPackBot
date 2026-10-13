import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, PermissionsBitField } from 'discord.js';
import { simulateRace, runRace, buildLobbyPayload, pickRacer, startRaceNow, RACERS } from '../src/modules/peaches/games/race.js';
import { shuffleAnswers, buildTriviaPayload, answerTrivia } from '../src/modules/peaches/games/trivia.js';
import { TRIVIA } from '../src/modules/peaches/games/triviaQuestions.js';
import { hidingSpots, guessHint, guessHideAndSeek } from '../src/modules/peaches/games/hideSeek.js';
import { createGame, getGame, resolveGame } from '../src/modules/peaches/games/store.js';
import { sweepExpiredGames } from '../src/modules/peaches/games/index.js';
import { getWallet, CHEESE_REWARDS } from '../src/modules/peaches/economy.js';
import { ensureState } from '../src/modules/peaches/state.js';

const user = (id) => ({ id, toString: () => `<@${id}>` });

test('simulateRace always finishes with exactly one valid winner', () => {
  for (let i = 0; i < 500; i++) {
    const { frames, winner } = simulateRace();
    assert.ok(winner >= 0 && winner < RACERS.length);
    assert.ok(frames.length > 0 && frames.length <= 200);
    const last = frames.at(-1).positions;
    assert.equal(last[winner], Math.max(...last));
  }
});

test('trivia bank: 4 distinct answers each, shuffle keeps track of the right one', () => {
  for (const { q, a } of TRIVIA) {
    assert.equal(a.length, 4, q);
    assert.equal(new Set(a).size, 4, q);
  }
  for (let i = 0; i < 50; i++) {
    const { order, correctSlot } = shuffleAnswers(4);
    assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
    assert.equal(order[correctSlot], 0);
  }
});

function triviaGame(guildId) {
  ensureState(guildId);
  return createGame({ guildId, type: 'trivia', channelId: 'c', durationMs: 60_000, data: { questionIndex: 0, order: [2, 0, 3, 1], correctSlot: 1, wrong: [] } });
}

test('trivia payloads render (open and revealed)', () => {
  const game = triviaGame('g-triv-ui');
  for (const opts of [{}, { reveal: true }, { reveal: true, winnerId: 'w' }]) {
    const p = buildTriviaPayload(game, opts);
    p.embeds[0].toJSON();
    p.components[0].toJSON();
  }
});

test('trivia: wrong answer locks you out, first right answer wins once', async () => {
  const game = triviaGame('g-triv');
  const calls = [];
  const click = (id) => ({ guildId: 'g-triv', user: user(id), reply: async (p) => calls.push(['reply', id, p]), update: async (p) => calls.push(['update', id, p]) });

  await answerTrivia(click('wrongo'), game.id, '0');
  await answerTrivia(click('wrongo'), game.id, '1'); // locked out even with the right one
  assert.equal(getGame(game.id).resolved, 0);
  await answerTrivia(click('smart'), game.id, '1');
  await answerTrivia(click('late'), game.id, '1');

  assert.equal(getGame(game.id).winnerId, 'smart');
  assert.equal(getWallet('g-triv', 'smart').cheese, CHEESE_REWARDS.trivia);
  assert.equal(getWallet('g-triv', 'late').cheese, 0);
  assert.deepEqual(calls.map(([kind, id]) => `${kind}:${id}`), ['reply:wrongo', 'reply:wrongo', 'update:smart', 'reply:late']);
});

test('hidingSpots: only public text channels the bot can post in', () => {
  const perms = (...flags) => ({ has: (f) => (Array.isArray(f) ? f : [f]).every((x) => flags.includes(x)) });
  const V = PermissionsBitField.Flags.ViewChannel;
  const S = PermissionsBitField.Flags.SendMessages;
  const channel = (id, { type = ChannelType.GuildText, everyoneSees = true, botCan = true } = {}) => ({
    id,
    type,
    permissionsFor: (who) => (who === 'everyone' ? (everyoneSees ? perms(V) : perms()) : botCan ? perms(V, S) : perms(V)),
  });
  const guild = {
    roles: { everyone: 'everyone' },
    members: { me: 'me' },
    channels: { cache: new Map([['a', channel('a')], ['b', channel('b')], ['secret', channel('secret', { everyoneSees: false })], ['muted', channel('muted', { botCan: false })], ['vc', channel('vc', { type: ChannelType.GuildVoice })]]) },
  };
  assert.deepEqual(hidingSpots(guild).map((c) => c.id), ['a', 'b']);
  assert.deepEqual(hidingSpots(guild, 'a').map((c) => c.id), ['b']);
});

test('guessHint warms up in the same category', () => {
  assert.match(guessHint({ parentId: 'cat1' }, { parentId: 'cat1' }), /close by/);
  assert.match(guessHint({ parentId: 'cat1' }, { parentId: 'cat2' }), /Not a whisker/);
  assert.match(guessHint({ parentId: null }, { parentId: null }), /Not a whisker/);
});

test('hide-and-seek: limited guesses, finder wins with first-try bonus', async () => {
  ensureState('g-hide');
  const game = createGame({ guildId: 'g-hide', type: 'hideseek', channelId: 'announce', durationMs: 60_000, data: { hidingChannelId: 'pantry', guesses: {} } });
  const replies = [];
  const look = (userId, channelId) => ({
    guildId: 'g-hide',
    channelId,
    channel: { id: channelId, parentId: null },
    guild: { channels: { cache: new Map([['pantry', { id: 'pantry', parentId: null }]]) } },
    user: user(userId),
    client: { channels: { fetch: async () => null } },
    reply: async (p) => replies.push([userId, p]),
  });

  for (let i = 0; i < 4; i++) await guessHideAndSeek(look('unlucky', 'kitchen'));
  assert.match(replies.at(-1)[1].embeds[0].data.description, /out of guesses/);

  await guessHideAndSeek(look('lucky', 'pantry'));
  assert.equal(getGame(game.id).winnerId, 'lucky');
  assert.equal(getWallet('g-hide', 'lucky').cheese, CHEESE_REWARDS.hideSeek + CHEESE_REWARDS.hideSeekFirstTry);
  assert.notEqual(replies.at(-1)[1].ephemeral, true, 'the win is announced publicly');
});

function fakeMessageClient() {
  const edits = [];
  const message = { edit: async (p) => edits.push(p) };
  return { edits, client: { channels: { fetch: async () => ({ messages: { fetch: async () => message } }) } } };
}

test('rat race: lobby renders, picks update, payouts for backers and joiners', async () => {
  ensureState('g-race');
  const game = createGame({ guildId: 'g-race', type: 'race', channelId: 'c', durationMs: 60_000, data: { bets: {}, hostId: 'host' } });
  game.messageId = 'm';
  const updates = [];
  const press = (id) => ({ guildId: 'g-race', user: user(id), member: { permissions: { has: () => false } }, update: async (p) => updates.push(p), reply: async (p) => updates.push(p) });

  for (const [id, pick] of [['a', 0], ['b', 1], ['c', 2], ['d', 3]]) await pickRacer(press(id), game.id, String(pick));
  for (const row of updates.at(-1).components) row.toJSON();
  buildLobbyPayload(getGame(game.id)).embeds[0].toJSON();

  const { edits, client } = fakeMessageClient();
  // set message id so the race can edit it
  const { setGameMessage } = await import('../src/modules/peaches/games/store.js');
  setGameMessage(game.id, 'm');
  const result = await runRace(client, game.id, { frameMs: 0 });
  assert.ok(edits.length >= 2);
  const winnerBacker = ['a', 'b', 'c', 'd'][result.winner];
  assert.equal(getWallet('g-race', winnerBacker).cheese, CHEESE_REWARDS.raceWin + CHEESE_REWARDS.raceJoin);
  for (const id of ['a', 'b', 'c', 'd'].filter((x) => x !== winnerBacker)) assert.equal(getWallet('g-race', id).cheese, CHEESE_REWARDS.raceJoin);

  assert.equal(await runRace(client, game.id, { frameMs: 0 }), null, 'a race only runs once');
  await pickRacer(press('late'), game.id, '0');
  assert.match(updates.at(-1).embeds[0].data.description, /Too late/);
});

test('only the host (or a manager) can start a race early', async () => {
  const game = createGame({ guildId: 'g-race2', type: 'race', channelId: 'c', durationMs: 60_000, data: { bets: {}, hostId: 'host' } });
  const replies = [];
  await startRaceNow({ guildId: 'g-race2', user: user('rando'), member: { permissions: { has: () => false } }, reply: async (p) => replies.push(p) }, game.id);
  assert.equal(replies[0].ephemeral, true);
  assert.equal(getGame(game.id).resolved, 0);
});

test('sweep finishes expired games of every type, once', async () => {
  ensureState('g-sweep');
  const games = ['hideseek', 'trivia', 'race'].map((type) =>
    createGame({ guildId: 'g-sweep', type, channelId: 'c', durationMs: -1000, data: type === 'race' ? { bets: {} } : type === 'trivia' ? { questionIndex: 0, order: [0, 1, 2, 3], correctSlot: 0, wrong: [] } : { hidingChannelId: 'x', guesses: {} } }),
  );
  const { client } = fakeMessageClient();
  await sweepExpiredGames(client);
  for (const g of games) assert.equal(getGame(g.id).resolved, 1, g.type);
  assert.equal(resolveGame(games[0].id), false);
});
