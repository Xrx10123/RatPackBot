import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordPlay, getMusicStats, recentUris, quizPool } from '../src/modules/music/plays.js';
import { buildStatsEmbed, formatListeningTime } from '../src/modules/music/commands/musicstats.js';
import { pickAutoplayCandidate, findAutoplayTrack, autoPlayFunction, AUTOPLAY_REQUESTER } from '../src/modules/music/autoplay.js';
import { dedupeByTitle, buildRound, snippetStart, buildRoundPayload, scoreboard, quizButtons, _registerQuizForTests, _nextRoundForTests, getQuiz, ROUND_MS, CHEESE_FOR_WINNER, CHEESE_PER_CORRECT } from '../src/modules/music/quiz.js';
import { buildPanelPayload } from '../src/modules/music/ui/panel.js';
import { updateGuildConfig } from '../src/core/guildConfig.js';
import { getWallet } from '../src/modules/peaches/economy.js';

const DAY = 86_400_000;
const track = (title, author, uri, extra = {}) => ({ info: { title, author, uri, identifier: uri?.split('=').pop(), duration: 200_000, isStream: false, sourceName: 'youtube', ...extra }, requester: { id: 'dj1' } });

test('plays are recorded and summarised by period', () => {
  const now = 1000 * DAY;
  recordPlay('g-stats', track('Song A', 'Band X', 'u:a'), now - DAY);
  recordPlay('g-stats', track('Song A', 'Band X', 'u:a'), now - 2 * DAY);
  recordPlay('g-stats', track('Song B', 'band x', 'u:b'), now - 3 * DAY);
  recordPlay('g-stats', { ...track('Old', 'Y', 'u:old'), requester: AUTOPLAY_REQUESTER }, now - 60 * DAY);
  recordPlay('g-stats', track('Radio', 'Z', 'u:radio', { isStream: true, duration: 0 }), now - DAY);
  recordPlay('g-stats', { info: {} }, now); // junk is ignored

  const week = getMusicStats('g-stats', 'week', now);
  assert.equal(week.plays, 4);
  assert.equal(week.topTracks[0].title, 'Song A');
  assert.equal(Number(week.topTracks[0].plays), 2);
  assert.equal(Number(week.topArtists[0].plays), 3, 'artists group case-insensitively');
  assert.equal(week.topDJs[0].userId, 'dj1');
  assert.equal(week.listenedMs, 3 * 200_000, 'streams excluded from listening time');

  const all = getMusicStats('g-stats', 'all', now);
  assert.equal(all.plays, 5);
  assert.equal(Number(all.topDJs[0].plays), 4, 'autoplay has no DJ');
  buildStatsEmbed(all, 'all').toJSON();
  buildStatsEmbed(getMusicStats('empty-guild', 'week', now), 'week').toJSON();
  assert.equal(formatListeningTime(90 * 60_000), '1 hour 30 min');
  assert.deepEqual(recentUris('g-stats', 2), ['u:radio', 'u:a'], 'newest first, insertion order breaks ties');
});

test('autoplay candidate: skips streams, repeats and the song that just ended', () => {
  const last = track('Now', 'A', 'https://youtube.com/watch?v=now');
  const tracks = [last, track('Live', 'A', 'u:live', { isStream: true }), track('Played', 'A', 'u:played'), track('Fresh', 'A', 'u:fresh')];
  assert.equal(pickAutoplayCandidate(tracks, { lastTrack: last, recent: new Set(['u:played']), random: () => 0 }).info.title, 'Fresh');
  assert.equal(pickAutoplayCandidate([last], { lastTrack: last }), null);
  assert.equal(pickAutoplayCandidate(undefined), null);
});

function fakeSearchPlayer(guildId, results) {
  const queries = [];
  const added = [];
  const data = new Map();
  return {
    guildId,
    queries,
    added,
    get: (k) => data.get(k),
    set: (k, v) => data.set(k, v),
    queue: { previous: [], add: async (t) => added.push(t) },
    search: async ({ query }) => {
      queries.push(query);
      return { tracks: results(query) ?? [] };
    },
  };
}

test('autoplay tries the YouTube mix, then the artist, then server favourites', async () => {
  const last = track('Now', 'Some Artist - Topic', 'https://www.youtube.com/watch?v=abc123');
  const mixPlayer = fakeSearchPlayer('g-auto', (q) => (q.includes('list=RDabc123') ? [last, track('Mix pick', 'B', 'u:mix')] : []));
  assert.equal((await findAutoplayTrack(mixPlayer, last, { random: () => 0 })).info.title, 'Mix pick');

  const artistPlayer = fakeSearchPlayer('g-auto', (q) => (q === 'ytsearch:Some Artist' ? [track('Artist pick', 'Some Artist', 'u:art')] : []));
  assert.equal((await findAutoplayTrack(artistPlayer, last, { random: () => 0 })).info.title, 'Artist pick');

  recordPlay('g-auto-fav', track('Fave', 'F', 'u:fave', { duration: 200_000 }), Date.now() - 10 * DAY);
  const favPlayer = fakeSearchPlayer('g-auto-fav', (q) => (q === 'u:fave' ? [track('Fave', 'F', 'u:fave')] : []));
  // u:fave is in recent history, so with nothing else available autoplay gives up rather than repeat
  assert.equal(await findAutoplayTrack(favPlayer, { info: { title: 'x' } }, { random: () => 0 }), null);
});

test('autoPlayFunction only runs when the server turned autoplay on, and never mid-quiz', async () => {
  const last = track('Now', 'A', 'https://www.youtube.com/watch?v=zzz');
  const results = (q) => (q.includes('list=RD') ? [track('Next', 'B', 'u:next-auto')] : []);
  updateGuildConfig('g-ap', { autoplay: 0 });
  const off = fakeSearchPlayer('g-ap', results);
  await autoPlayFunction(off, last);
  assert.equal(off.added.length, 0);

  updateGuildConfig('g-ap', { autoplay: 1 });
  const on = fakeSearchPlayer('g-ap', results);
  await autoPlayFunction(on, last);
  assert.equal(on.added[0].info.title, 'Next');

  const quizzing = fakeSearchPlayer('g-ap', results);
  quizzing.set('quiz', true);
  await autoPlayFunction(quizzing, last);
  assert.equal(quizzing.added.length, 0);
});

test('quiz pool: real songs only, distinct titles', () => {
  recordPlay('g-qp', track('Short', 'A', 'u:short', { duration: 20_000 }));
  recordPlay('g-qp', track('Stream', 'A', 'u:s', { isStream: true }));
  recordPlay('g-qp', track('Song', 'A', 'u:1'));
  recordPlay('g-qp', track('SONG!', 'A', 'u:2'));
  recordPlay('g-qp', track('Other', 'A', 'u:3'));
  const pool = quizPool('g-qp');
  assert.deepEqual(pool.map((r) => r.uri).sort(), ['u:1', 'u:2', 'u:3']);
  assert.equal(dedupeByTitle(pool).length, 2);
});

test('rounds: 4 distinct options, answer in place, snippet from the middle', () => {
  const pool = ['a', 'b', 'c', 'd', 'e'].map((x) => ({ title: x, uri: `u:${x}` }));
  for (let i = 0; i < 50; i++) {
    const r = buildRound(pool, new Set(['u:a']));
    assert.equal(new Set(r.options.map((o) => o.uri)).size, 4);
    assert.equal(r.options[r.correct], r.answer);
    assert.notEqual(r.answer.uri, 'u:a', 'used songs are not repeated');
  }
  assert.equal(buildRound(pool.slice(0, 3), new Set()), null);
  for (const d of [45_000, 200_000, 600_000]) {
    for (const rnd of [0, 0.5, 0.999]) {
      const start = snippetStart(d, () => rnd);
      assert.ok(start >= 0 && start + ROUND_MS <= d, `${d} ${rnd}`);
    }
  }
});

test('scoreboard: ties share the crown, cheese per correct answer', () => {
  const { winners, payouts } = scoreboard(new Map([['a', 2], ['b', 2], ['c', 1]]));
  assert.deepEqual(winners.sort(), ['a', 'b']);
  assert.equal(payouts.find((p) => p.userId === 'a').cheese, 2 * CHEESE_PER_CORRECT + CHEESE_FOR_WINNER);
  assert.equal(payouts.find((p) => p.userId === 'c').cheese, CHEESE_PER_CORRECT);
  assert.deepEqual(scoreboard(new Map()).winners, []);
});

test('mid-quiz the panel hides the title and controls', () => {
  const player = { get: (k) => k === 'quiz', guildId: 'g', voiceChannelId: 'v', queue: { current: track('Secret', 'X', 'u:x'), tracks: [], previous: [] }, volume: 100, repeatMode: 'off', position: 0 };
  const payload = buildPanelPayload(player);
  assert.equal(payload.components.length, 0);
  assert.doesNotMatch(payload.embeds[0].data.description, /Secret/);
});

test('a full quiz: wrong answers lock out, first right answer scores, cheese paid at the end', async () => {
  for (const [i, t] of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].entries()) recordPlay('g-quiz', track(t, 'Band', `u:q${i}`));
  const edits = [];
  const played = [];
  const data = new Map([['quiz', true]]);
  const player = {
    get: (k) => data.get(k),
    set: (k, v) => data.set(k, v),
    search: async ({ query }) => ({ tracks: [track('x', 'Band', query)] }),
    play: async (opts) => played.push(opts),
    stopPlaying: async () => {},
  };
  const quiz = _registerQuizForTests({
    id: 'qz1', guildId: 'g-quiz', voiceChannelId: 'vc', startedBy: 'host', rounds: 1, roundNumber: 0,
    pool: dedupeByTitle(quizPool('g-quiz')), used: new Set(), scores: new Map(), player, random: Math.random,
    current: null, timer: null, message: { edit: async (p) => edits.push(p) },
  });
  await _nextRoundForTests(quiz);
  assert.equal(played.length, 1);
  assert.ok(played[0].position > 0);
  for (const row of edits[0].components) row.toJSON();

  const replies = [];
  const click = (userId, i) => quizButtons.quiz({ guildId: 'g-quiz', user: { id: userId }, reply: async (p) => replies.push(p), deferUpdate: async () => {} }, 'qz1', '1', String(i));
  const wrong = (quiz.current.correct + 1) % 4;
  await click('guesser', wrong);
  await click('guesser', quiz.current.correct);
  assert.equal(replies.length, 2);
  assert.match(replies[1].embeds[0].data.description, /One guess/);
  await click('winner', quiz.current.correct);
  assert.equal(quiz.scores.get('winner'), 1);
  assert.match(edits.at(-1).embeds[0].data.description, /<@winner> got it/);

  await _nextRoundForTests(quiz); // rounds done → finish
  assert.equal(getQuiz('g-quiz'), null);
  assert.equal(data.get('quiz'), false);
  assert.equal(getWallet('g-quiz', 'winner').cheese, CHEESE_PER_CORRECT + CHEESE_FOR_WINNER);
  assert.match(edits.at(-1).embeds[0].data.title, /final scores/);
});

test('only the starter or a manager can end a quiz early', async () => {
  const quiz = _registerQuizForTests({ id: 'qz2', guildId: 'g-quiz2', startedBy: 'host', scores: new Map(), player: { set() {}, stopPlaying: async () => {} }, message: null, timer: null });
  const replies = [];
  await quizButtons.quiz_end({ guildId: 'g-quiz2', user: { id: 'rando' }, member: { permissions: { has: () => false } }, reply: async (p) => replies.push(p) }, 'qz2');
  assert.ok(getQuiz('g-quiz2'));
  await quizButtons.quiz_end({ guildId: 'g-quiz2', user: { id: 'host', username: 'host' }, member: { permissions: { has: () => false } }, deferUpdate: async () => {} }, 'qz2');
  assert.equal(getQuiz('g-quiz2'), null);
  assert.equal(quiz.id, 'qz2');
});
