import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitsPlayers, freshnessWeight, weightedPick, pickPollOptions, splitTeams, tallyPoll, playerRange } from '../src/modules/gamenight/logic.js';
import { addGame, listGames, findGameByName, getGame, createPoll, getPoll, setPollMessage, saveVotes } from '../src/modules/gamenight/store.js';
import { games, gameButtons, finishPoll, buildPickPayload, buildPollPayload } from '../src/modules/gamenight/commands/games.js';
import { teams, parseMentions, buildTeamsPayload } from '../src/modules/gamenight/commands/teams.js';

const DAY = 86_400_000;

test('player-count filter', () => {
  assert.equal(fitsPlayers({ minPlayers: 2, maxPlayers: 4 }, 3), true);
  assert.equal(fitsPlayers({ minPlayers: 2, maxPlayers: 4 }, 5), false);
  assert.equal(fitsPlayers({ minPlayers: 5, maxPlayers: null }, 4), false);
  assert.equal(fitsPlayers({ minPlayers: null, maxPlayers: null }, 99), true);
  assert.equal(fitsPlayers({ minPlayers: 6, maxPlayers: 8 }, null), true, 'unknown headcount → everything');
  assert.equal(playerRange({ minPlayers: 4, maxPlayers: 4 }), '4 players');
  assert.equal(playerRange({ minPlayers: 2, maxPlayers: null }), '2+ players');
  assert.equal(playerRange({ minPlayers: null, maxPlayers: null }), '');
});

test('picker favours games not played recently and can exclude the current one', () => {
  const now = 100 * DAY;
  assert.ok(freshnessWeight({ lastPlayedAt: null }, now) > freshnessWeight({ lastPlayedAt: now - DAY / 2 }, now));
  const pool = [
    { id: 'yesterday', lastPlayedAt: now - DAY / 4 },
    { id: 'ages', lastPlayedAt: now - 30 * DAY },
  ];
  const counts = { yesterday: 0, ages: 0 };
  for (let i = 0; i < 2000; i++) counts[weightedPick(pool, { now }).id] += 1;
  assert.ok(counts.ages > counts.yesterday * 5);
  for (let i = 0; i < 50; i++) assert.equal(weightedPick(pool, { now, exclude: 'ages' }).id, 'yesterday');
  assert.equal(weightedPick([{ id: 'only' }], { exclude: 'only' }).id, 'only', 'never comes back empty with one game');
  assert.equal(weightedPick([]), null);
});

test('poll options are distinct; teams are even', () => {
  const pool = Array.from({ length: 9 }, (_, i) => ({ id: `g${i}` }));
  const options = pickPollOptions(pool, 5);
  assert.equal(new Set(options.map((g) => g.id)).size, 5);
  assert.equal(pickPollOptions(pool.slice(0, 2), 5).length, 2);

  const split = splitTeams(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3);
  assert.deepEqual(split.map((t) => t.length).sort(), [2, 2, 3]);
  assert.deepEqual(split.flat().sort(), ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
});

test('tallyPoll: most votes wins, ties broken, no votes = no winner', () => {
  assert.deepEqual(tallyPoll(3, { a: 1, b: 1, c: 0 }), { index: 1, tally: [1, 2, 0], tied: false });
  const tie = tallyPoll(2, { a: 0, b: 1 }, () => 0.99);
  assert.equal(tie.tied, true);
  assert.equal(tie.index, 1);
  assert.equal(tallyPoll(3, {}).index, null);
  assert.equal(tallyPoll(2, { a: 7, b: -1 }).index, null, 'garbage votes ignored');
});

test('games list: case-insensitive duplicates rejected', () => {
  assert.ok(addGame({ guildId: 'g-gn', name: 'Lethal Company', minPlayers: 1, maxPlayers: 4, addedBy: 'u' }));
  assert.equal(addGame({ guildId: 'g-gn', name: 'lethal company', addedBy: 'u' }), null);
  assert.ok(addGame({ guildId: 'other-guild', name: 'Lethal Company', addedBy: 'u' }), 'per server');
  assert.equal(findGameByName('g-gn', 'LETHAL COMPANY').name, 'Lethal Company');
});

function cmd({ sub, options = {}, guildId = 'g-cmd-gn', userId = 'u1', manager = false, voiceMembers = null }) {
  const replies = [];
  const members = voiceMembers ? new Map(voiceMembers.map((id) => [id, { user: { bot: false } }])) : null;
  if (members) members.filter = (fn) => { const m = new Map([...members].filter(([, v]) => fn(v))); m.filter = members.filter; return m; };
  return {
    replies,
    guildId,
    channelId: 'c',
    user: { id: userId, toString: () => `<@${userId}>` },
    member: { permissions: { has: () => manager }, voice: { channel: members ? { members } : null } },
    client: {},
    options: {
      getSubcommand: () => sub,
      getString: (k) => options[k] ?? null,
      getInteger: (k) => options[k] ?? null,
    },
    reply: async (p) => replies.push(p),
    fetchReply: async () => ({ id: `msg-${Math.random()}` }),
  };
}

test('/games pick respects headcount from the voice channel', async () => {
  for (const [name, min, max] of [['Chess', 2, 2], ['Phasmophobia', 1, 4], ['Jackbox', 3, 8]]) addGame({ guildId: 'g-pick', name, minPlayers: min, maxPlayers: max, addedBy: 'u' });
  for (let i = 0; i < 20; i++) {
    const i1 = cmd({ sub: 'pick', guildId: 'g-pick', voiceMembers: ['a', 'b', 'c', 'd', 'e'] });
    await games.execute(i1);
    assert.match(i1.replies[0].embeds[0].data.description, /Jackbox/);
  }
  const none = cmd({ sub: 'pick', guildId: 'g-pick', options: { players: 20 } });
  await games.execute(none);
  assert.equal(none.replies[0].ephemeral, true);
  for (const row of buildPickPayload('g-pick', listGames('g-pick')[0], 3).components) row.toJSON();
});

test('only the adder or a manager can remove a game', async () => {
  const game = addGame({ guildId: 'g-rm', name: 'Stardew Valley', addedBy: 'owner' });
  const stranger = cmd({ sub: 'remove', guildId: 'g-rm', userId: 'stranger', options: { game: game.id } });
  await games.execute(stranger);
  assert.ok(getGame(game.id));
  const mgr = cmd({ sub: 'remove', guildId: 'g-rm', userId: 'boss', manager: true, options: { game: game.id } });
  await games.execute(mgr);
  assert.equal(getGame(game.id), null);
});

test('vote flow: change your vote, finish once, winner marked as played', async () => {
  const opts = ['Minecraft', 'Overcooked', 'Among Us'].map((name) => addGame({ guildId: 'g-vote', name, addedBy: 'u' }));
  const poll = createPoll({ guildId: 'g-vote', channelId: 'c', createdBy: 'host', options: opts.map((g) => g.id), durationMs: 60_000 });
  setPollMessage(poll.id, 'm');
  const updates = [];
  const press = (userId, i) => gameButtons.vote({ guildId: 'g-vote', user: { id: userId }, update: async (p) => updates.push(p), reply: async (p) => updates.push(p) }, poll.id, String(i));
  await press('a', 0);
  await press('a', 1); // changed mind
  await press('b', 1);
  await press('c', 2);
  assert.deepEqual(getPoll(poll.id).votes, { a: 1, b: 1, c: 2 });
  for (const row of updates.at(-1).components) row.toJSON();

  const edits = [];
  const client = { channels: { fetch: async () => ({ messages: { fetch: async () => ({ edit: async (p) => edits.push(p) }) } }) } };
  const winner = await finishPoll(client, poll.id);
  assert.equal(winner.name, 'Overcooked');
  assert.ok(getGame(opts[1].id).lastPlayedAt);
  assert.equal(await finishPoll(client, poll.id), null, 'only once');
  assert.match(edits[0].embeds[0].data.description, /Overcooked\*\* it is/);
  await press('late', 0);
  assert.match(updates.at(-1).embeds[0].data.description, /closed/);
});

test('poll payload with long names stays valid', () => {
  const longGames = Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, name: 'Z'.repeat(80) }));
  const poll = { id: 'p', endsAt: Date.now() + 1000, votes: {} };
  for (const row of buildPollPayload(poll, longGames).components) row.toJSON();
});

test('/teams from mentions or voice; never pings', async () => {
  assert.deepEqual(parseMentions('<@111111111111111111> and <@!222222222222222222> <@111111111111111111>'), ['111111111111111111', '222222222222222222']);
  const fromVoice = cmd({ sub: null, options: { count: 2 }, voiceMembers: ['a', 'b', 'c', 'd', 'e'] });
  await teams.execute(fromVoice);
  const p = fromVoice.replies[0];
  assert.deepEqual(p.allowedMentions, { parse: [] });
  assert.match(p.embeds[0].data.description, /Team Cheddar|Team Peach/);
  const tooFew = cmd({ sub: null, options: { count: 3, players: '<@111111111111111111>' } });
  await teams.execute(tooFew);
  assert.equal(tooFew.replies[0].ephemeral, true);
  buildTeamsPayload(['a', 'b', 'c', 'd', 'e', 'f'], 6).components[0].toJSON();
});
