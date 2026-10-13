import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getActiveSeason, localDateParts } from '../src/modules/peaches/seasons.js';
import { pickVariant } from '../src/modules/peaches/spawns.js';
import { VARIANTS } from '../src/modules/peaches/variants.js';
import { ITEMS, RARITY, rollItem, findableItems, giveItem, getAlbum, getServerFoundKeys, hasItemSince, maybeFindSomething } from '../src/modules/peaches/collectibles.js';
import { describeBirthday, birthdayFromDate, ensureBirthday, getBirthdayInfo, birthdayStatusLine, buildBirthdayPayload } from '../src/modules/peaches/birthday.js';
import { buildSpawnPayload, spawnMediaKey } from '../src/modules/peaches/ui/spawnEmbed.js';
import { createSpawn } from '../src/modules/peaches/spawns.js';
import { ensureState } from '../src/modules/peaches/state.js';
import { updateGuildConfig } from '../src/core/guildConfig.js';
import { eventButtons } from '../src/modules/peaches/handlers/eventButtons.js';
import { getMediaForMoment } from '../src/modules/peaches/media.js';

const at = (iso) => new Date(iso);

test('Halloween runs Oct 15–31 in the server timezone', () => {
  assert.equal(getActiveSeason(at('2026-10-14T12:00:00Z'), 'UTC'), null);
  assert.equal(getActiveSeason(at('2026-10-15T00:00:00Z'), 'UTC'), 'halloween');
  assert.equal(getActiveSeason(at('2026-10-31T23:59:00Z'), 'UTC'), 'halloween');
  assert.equal(getActiveSeason(at('2026-11-01T00:00:00Z'), 'UTC'), null);
  // 03:00 UTC Nov 1 is still Oct 31 evening in Los Angeles
  assert.equal(getActiveSeason(at('2026-11-01T03:00:00Z'), 'America/Los_Angeles'), 'halloween');
  assert.equal(getActiveSeason(at('2026-07-01T00:00:00Z'), 'Bad/Zone'), null);
});

test('PEACHES_FORCE_SEASON previews a season out of its dates', () => {
  process.env.PEACHES_FORCE_SEASON = 'halloween';
  try {
    assert.equal(getActiveSeason(at('2026-07-01T00:00:00Z'), 'UTC'), 'halloween');
  } finally {
    delete process.env.PEACHES_FORCE_SEASON;
  }
});

test('localDateParts reads the wall clock in a zone', () => {
  assert.deepEqual(localDateParts(at('2026-03-01T02:00:00Z'), 'America/New_York'), { year: 2026, month: 2, day: 28, hour: 21 });
});

test('Ghost Peaches only spawns in Halloween', () => {
  const sweep = (season) => new Set(Array.from({ length: 200 }, (_, i) => pickVariant(season, () => i / 200)));
  assert.ok(!sweep(null).has('ghost'));
  assert.ok(sweep('halloween').has('ghost'));
  assert.ok(VARIANTS.ghost && VARIANTS.ghost.expiresInMs > 0);
});

test('collectible catalog: unique keys, valid rarities, every item has emoji+blurb', () => {
  assert.equal(new Set(ITEMS.map((i) => i.key)).size, ITEMS.length);
  for (const item of ITEMS) {
    assert.ok(RARITY[item.rarity], item.key);
    assert.ok(item.emoji && item.blurb && item.name, item.key);
  }
});

test('seasonal items are only findable in season, birthday cake never drops randomly', () => {
  assert.ok(!findableItems(null).some((i) => i.season));
  assert.ok(findableItems('halloween').some((i) => i.season === 'halloween'));
  for (let i = 0; i < 100; i++) {
    const item = rollItem({ season: 'halloween', random: () => i / 100 });
    assert.notEqual(item.key, 'cake_slice');
    assert.ok(!item.season || item.season === 'halloween');
  }
  for (let i = 0; i < 50; i++) assert.equal(rollItem({ season: 'halloween', onlySeasonal: true, random: () => i / 50 }).season, 'halloween');
});

test('albums count duplicates and the server tally is per guild', () => {
  giveItem('g-album', 'u1', 'sock');
  giveItem('g-album', 'u1', 'sock');
  giveItem('g-album', 'u2', 'peach');
  assert.equal(getAlbum('g-album', 'u1').get('sock'), 2);
  assert.deepEqual([...getServerFoundKeys('g-album')].sort(), ['peach', 'sock']);
  assert.equal(getServerFoundKeys('elsewhere').size, 0);
  assert.equal(hasItemSince('g-album', 'u1', 'sock', Date.now() - 1000), true);
  assert.equal(hasItemSince('g-album', 'u1', 'sock', Date.now() + 1000), false);
  assert.equal(maybeFindSomething('g-album', 'u3', { chance: 0 }), null);
  assert.ok(maybeFindSomething('g-album', 'u3', { chance: 1 }));
});

test('birthday is the join day in the server timezone', () => {
  // Joined late on Oct 12 in LA = Oct 13 UTC
  assert.deepEqual(birthdayFromDate(at('2025-10-13T05:00:00Z'), 'America/Los_Angeles'), { birthday: '10-12', birthYear: 2025 });
  assert.deepEqual(birthdayFromDate(at('2025-10-13T05:00:00Z'), 'UTC'), { birthday: '10-13', birthYear: 2025 });
});

test('describeBirthday: today, countdown, year rollover, Feb 29', () => {
  const bday = { birthday: '10-13', birthYear: 2025 };
  const today = describeBirthday(bday, at('2026-10-13T15:00:00Z'), 'UTC');
  assert.equal(today.isToday, true);
  assert.equal(today.turning, 1);
  assert.equal(today.display, 'October 13');

  const before = describeBirthday(bday, at('2026-10-01T15:00:00Z'), 'UTC');
  assert.equal(before.daysUntil, 12);

  const after = describeBirthday(bday, at('2026-10-14T15:00:00Z'), 'UTC');
  assert.equal(after.daysUntil, 364);
  assert.equal(after.turning, 2);

  const leap = { birthday: '02-29', birthYear: 2024 };
  assert.equal(describeBirthday(leap, at('2026-02-28T12:00:00Z'), 'UTC').isToday, true);
  assert.equal(describeBirthday(leap, at('2028-02-29T12:00:00Z'), 'UTC').isToday, true);
  assert.equal(describeBirthday(leap, at('2028-02-28T12:00:00Z'), 'UTC').isToday, false);
});

test('ensureBirthday records the join day once and never moves it', () => {
  updateGuildConfig('g-bday', { timezone: 'UTC' });
  const guild = (joinedAt) => ({ id: 'g-bday', members: { me: { joinedAt } } });
  ensureBirthday(guild(at('2025-06-01T12:00:00Z')));
  ensureBirthday(guild(at('2026-01-01T12:00:00Z'))); // re-invite later
  const info = getBirthdayInfo('g-bday', at('2026-06-01T12:00:00Z'));
  assert.equal(info.birthday, '06-01');
  assert.equal(info.isToday, true);
  assert.match(birthdayStatusLine(info), /birthday today/);
  assert.match(birthdayStatusLine(getBirthdayInfo('g-bday', at('2026-05-31T12:00:00Z'))), /tomorrow/);
});

test('bundled art resolves for Halloween, ghost, and birthday', () => {
  for (const key of ['halloween', 'ghost', 'birthday']) assert.equal(getMediaForMoment(key)?.type, 'file', key);
});

test('spawn message: Halloween adds costume, colour and trick-or-treat row', async () => {
  updateGuildConfig('g-spooky', { timezone: 'UTC' });
  const state = { ...ensureState('g-spooky'), mood: 'content' };
  const spawn = createSpawn({ guildId: 'g-spooky', channelId: 'c', variant: 'normal', expiresInMs: 60_000 });

  const october = await buildSpawnPayload(state, spawn, { now: at('2026-10-20T12:00:00Z') });
  const rows = october.components.map((r) => r.toJSON());
  october.embeds[0].toJSON();
  assert.equal(rows.length, 2);
  assert.equal(rows[1].components[0].custom_id, `peaches:trickortreat:${spawn.id}`);
  assert.match(october.embeds[0].data.title, /^🎃/);

  const june = await buildSpawnPayload(state, spawn, { now: at('2026-06-20T12:00:00Z') });
  assert.equal(june.components.length, 1);

  assert.equal(spawnMediaKey({ variant: 'ghost' }, state, 'halloween'), 'ghost');
  assert.equal(spawnMediaKey({ variant: 'normal' }, state, 'halloween', () => 0), 'halloween');
  assert.equal(spawnMediaKey({ variant: 'normal' }, state, null), 'content');
});

test('birthday post renders with the cake button', async () => {
  const payload = await buildBirthdayPayload('Peaches', 2);
  payload.embeds[0].toJSON();
  assert.equal(payload.components[0].toJSON().components[0].custom_id, 'peaches:birthday_cake');
  assert.equal(payload.files.length, 1);
});

test('trick-or-treat: one knock per person per visit', async () => {
  ensureState('g-tot');
  const spawn = createSpawn({ guildId: 'g-tot', channelId: 'c', variant: 'ghost', expiresInMs: 60_000 });
  const knock = async (userId) => {
    const replies = [];
    await eventButtons.trickortreat({ guildId: 'g-tot', user: { id: userId, displayName: userId, toString: () => `<@${userId}>` }, reply: async (p) => replies.push(p) }, spawn.id);
    return replies[0];
  };
  const first = await knock('kid');
  assert.notEqual(first.ephemeral, true);
  assert.match(first.embeds[0].data.title, /Treat|Trick/);
  const second = await knock('kid');
  assert.equal(second.ephemeral, true);
  assert.notEqual((await knock('other-kid')).ephemeral, true);
});

import { birthdayTick } from '../src/modules/peaches/birthday.js';
import { setSpawnChannelIds } from '../src/modules/peaches/config.js';
import { pet } from '../src/modules/peaches/commands/pet.js';

test('birthdayTick posts once per year, only from 9am local, in her spawn channel', async () => {
  updateGuildConfig('g-party', { timezone: 'UTC' });
  setSpawnChannelIds('g-party', ['chan-party']);
  const sent = [];
  const guild = { id: 'g-party', members: { me: { joinedAt: at('2025-10-20T10:00:00Z') } } };
  const client = {
    guilds: { cache: new Map([['g-party', guild]]) },
    channels: { fetch: async (id) => (id === 'chan-party' ? { send: async (p) => sent.push(p) } : null) },
  };

  await birthdayTick(client, at('2026-10-20T06:00:00Z')); // birthday, but 6 AM
  assert.equal(sent.length, 0);
  await birthdayTick(client, at('2026-10-20T10:00:00Z'));
  await birthdayTick(client, at('2026-10-20T11:00:00Z'));
  assert.equal(sent.length, 1, 'once per birthday');
  assert.match(sent[0].embeds[0].data.description, /turns 1|1 year/);
  await birthdayTick(client, at('2027-10-20T10:00:00Z'));
  assert.equal(sent.length, 2, 'and again next year');
});

test('/pet album renders for an empty and a populated album', async () => {
  giveItem('g-alb2', 'collector', 'golden_cheese');
  for (const userId of ['collector', 'newbie']) {
    const replies = [];
    await pet.execute({
      guildId: 'g-alb2',
      user: { id: userId, displayName: userId },
      options: { getSubcommand: () => 'album', getUser: () => null },
      reply: async (p) => replies.push(p),
    });
    const embed = replies[0].embeds[0].toJSON();
    assert.ok(embed.description.length < 4096);
    if (userId === 'collector') assert.match(embed.description, /Golden Cheese/);
    else assert.match(embed.title, /0\//);
  }
});
