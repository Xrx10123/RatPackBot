import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPanelPayload } from '../src/modules/music/ui/panel.js';
import { buildSearchResultsPayload } from '../src/modules/music/ui/search.js';
import { buildQueuePage } from '../src/modules/music/ui/queuePage.js';
import { cleanTrackForLyrics } from '../src/modules/music/commands/lyrics.js';
import { registerSkipVote } from '../src/modules/music/voteSkip.js';
import {
  createHoard,
  getHoardByName,
  getOwnHoardByName,
  ensureCommunityFavorites,
  addTrackToHoard,
  removeTrackFromHoard,
  isCommunityOwned,
} from '../src/modules/music/hoards.js';

const track = (title, author, extra = {}) => ({ info: { title, author, uri: 'https://example.com/t', duration: 180_000, isStream: false, sourceName: 'youtube', ...extra }, requester: { id: '1' } });

function fakePlayer({ current = track('Now', 'Artist'), tracks = [] } = {}) {
  return {
    guildId: 'g-music',
    voiceChannelId: 'vc1',
    paused: false,
    repeatMode: 'off',
    volume: 100,
    position: 60_000,
    queue: { current, tracks, previous: [] },
  };
}

/** Serializes every component/embed — this is where discord.js enforces Discord's limits. */
function assertSendable(payload) {
  for (const row of payload.components ?? []) row.toJSON();
  for (const embed of payload.embeds ?? []) embed.toJSON();
}

test('panel renders with blank authors/titles and very long names (regression)', () => {
  const tracks = [track('', ''), track('x'.repeat(300), 'y'.repeat(300)), track('Radio', '', { isStream: true, duration: 0 })];
  assertSendable(buildPanelPayload(fakePlayer({ tracks })));
});

test('panel renders idle and with a stream as the current track', () => {
  assertSendable(buildPanelPayload(fakePlayer({ current: null })));
  assertSendable(buildPanelPayload(fakePlayer({ current: track('Live', '', { isStream: true, duration: 0, uri: null }) })));
});

test('panel caps the jump-to select at 25 options', () => {
  const tracks = Array.from({ length: 60 }, (_, i) => track(`T${i}`, 'A'));
  const payload = buildPanelPayload(fakePlayer({ tracks }));
  const select = payload.components.map((r) => r.toJSON()).find((r) => r.components[0].custom_id === 'music:panel_queueselect');
  assert.equal(select.components[0].options.length, 25);
  assert.ok(payload.components.length <= 5);
});

test('search results and queue page survive blank metadata', () => {
  assertSendable(buildSearchResultsPayload('abcd1234', [track('', ''), track('Song', '')]));
  assertSendable(buildQueuePage(fakePlayer({ tracks: Array.from({ length: 25 }, () => track('', '')) }), 99));
});

test('lyrics cleaner pulls artist/title out of YouTube-style titles', () => {
  assert.deepEqual(cleanTrackForLyrics('Rick Astley - Never Gonna Give You Up (Official Music Video)', 'Rick Astley'), {
    track: 'Never Gonna Give You Up',
    artist: 'Rick Astley',
  });
  assert.deepEqual(cleanTrackForLyrics('Bohemian Rhapsody (Remastered 2011)', 'Queen - Topic'), { track: 'Bohemian Rhapsody', artist: 'Queen' });
  assert.deepEqual(cleanTrackForLyrics('Blinding Lights', 'TheWeekndVEVO'), { track: 'Blinding Lights', artist: 'TheWeeknd' });
});

test('vote skip: threshold math and DJ bypass', () => {
  const data = new Map();
  const player = { get: (k) => data.get(k), set: (k, v) => data.set(k, v) };
  const member = (id, manager = false) => ({ id, permissions: { has: () => manager }, roles: { cache: new Map() } });
  const humans = new Map([1, 2, 3, 4].map((i) => [String(i), { user: { bot: false } }]));
  humans.filter = (fn) => ({ size: [...humans.values()].filter(fn).length });
  const vc = { members: humans };

  assert.deepEqual(registerSkipVote(player, member('1'), vc, { voteSkipThreshold: 50 }), { skip: false, votes: 1, needed: 2, total: 4 });
  assert.deepEqual(registerSkipVote(player, member('1'), vc, { voteSkipThreshold: 50 }).votes, 1, 'same member votes once');
  assert.equal(registerSkipVote(player, member('2'), vc, { voteSkipThreshold: 50 }).skip, true);
  assert.deepEqual(registerSkipVote(player, member('9', true), vc, {}), { skip: true, forced: true });
});

test('hoard lookup prefers your own hoard over a same-named public one', () => {
  createHoard({ guildId: 'g1', ownerId: 'alice', name: 'Chill', isPublic: true });
  const mine = createHoard({ guildId: 'g1', ownerId: 'bob', name: 'Chill', isPublic: false });
  assert.equal(getHoardByName('g1', 'bob', 'Chill').id, mine.id);
  assert.equal(getHoardByName('g1', 'carol', 'Chill').ownerId, 'alice');
  assert.equal(getOwnHoardByName('g1', 'carol', 'Chill'), undefined);
});

test("Community Favorites isn't hijacked by a member's same-named hoard", () => {
  createHoard({ guildId: 'g2', ownerId: 'dave', name: 'Community Favorites', isPublic: false });
  const fav = ensureCommunityFavorites('g2');
  assert.equal(fav.ownerId, 'community:g2');
  assert.equal(ensureCommunityFavorites('g2').id, fav.id, 'idempotent');
  assert.ok(isCommunityOwned(fav));
});

test('removeTrackFromHoard reports whether anything was removed', () => {
  const h = createHoard({ guildId: 'g3', ownerId: 'erin', name: 'Mix' });
  const row = addTrackToHoard(h.id, track('A', 'B'));
  assert.equal(removeTrackFromHoard(h.id, 999), false);
  assert.equal(removeTrackFromHoard(h.id, row.position), true);
});

import { buildQueuePositionChoices } from '../src/modules/music/ui/queueChoices.js';

test('queue position autocomplete: numbers filter by prefix, text fuzzy-matches titles', () => {
  const tracks = Array.from({ length: 30 }, (_, i) => track(`Song ${i + 1}`, i === 4 ? '' : 'Band'));
  tracks[11] = track('Bohemian Rhapsody', 'Queen');
  const choices = buildQueuePositionChoices(tracks, '');
  assert.equal(choices.length, 25);
  assert.equal(choices[0].value, 1);
  assert.match(choices[4].name, /Unknown/);
  assert.deepEqual(buildQueuePositionChoices(tracks, '1').map((c) => c.value), [1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  assert.equal(buildQueuePositionChoices(tracks, 'bohem')[0].value, 12);
  for (const c of buildQueuePositionChoices([track('x'.repeat(300), 'y')], '')) assert.ok(c.name.length <= 100);
});
