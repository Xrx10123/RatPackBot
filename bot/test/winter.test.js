import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEASONS, getActiveSeason } from '../src/modules/peaches/seasons.js';
import { pickVariant, createSpawn } from '../src/modules/peaches/spawns.js';
import { VARIANTS } from '../src/modules/peaches/variants.js';
import { buildSpawnPayload } from '../src/modules/peaches/ui/spawnEmbed.js';
import { ensureState } from '../src/modules/peaches/state.js';
import { updateGuildConfig } from '../src/core/guildConfig.js';
import { eventButtons } from '../src/modules/peaches/handlers/eventButtons.js';
import { findableItems } from '../src/modules/peaches/collectibles.js';
import { itemsForSale } from '../src/modules/peaches/shop.js';
import { getMediaForMoment } from '../src/modules/peaches/media.js';

const at = (iso) => new Date(iso);

test('winter runs through December and seasons never overlap', () => {
  assert.equal(getActiveSeason(at('2026-11-30T12:00:00Z'), 'UTC'), null);
  assert.equal(getActiveSeason(at('2026-12-01T00:00:00Z'), 'UTC'), 'winter');
  assert.equal(getActiveSeason(at('2026-12-31T23:00:00Z'), 'UTC'), 'winter');
  assert.equal(getActiveSeason(at('2027-01-01T00:00:00Z'), 'UTC'), null);
  const days = new Map();
  for (const [key, s] of Object.entries(SEASONS)) {
    for (let m = s.start[0]; m <= s.end[0]; m++) {
      const from = m === s.start[0] ? s.start[1] : 1;
      const to = m === s.end[0] ? s.end[1] : 31;
      for (let d = from; d <= to; d++) {
        assert.ok(!days.has(`${m}-${d}`), `${key} overlaps ${days.get(`${m}-${d}`)}`);
        days.set(`${m}-${d}`, key);
      }
    }
  }
});

test('every season has art, a button and its own variant', () => {
  for (const [key, season] of Object.entries(SEASONS)) {
    assert.equal(getMediaForMoment(season.media)?.type, 'file', key);
    assert.ok(eventButtons[season.button.action], `${key} button handler`);
    const variant = Object.entries(VARIANTS).find(([, v]) => v.season === key)?.[0];
    assert.ok(variant, `${key} variant`);
    assert.equal(getMediaForMoment(variant)?.type, 'file', `${variant} art`);
  }
});

test('Frosty only in winter, Ghost only in Halloween', () => {
  const sweep = (season) => new Set(Array.from({ length: 300 }, (_, i) => pickVariant(season, () => i / 300)));
  assert.ok(sweep('winter').has('frosty'));
  assert.ok(!sweep('winter').has('ghost'));
  assert.ok(!sweep('halloween').has('frosty'));
  assert.ok(!sweep(null).has('frosty'));
});

test('a December spawn has the present button and Santa-hat costume', async () => {
  updateGuildConfig('g-xmas', { timezone: 'UTC' });
  const state = { ...ensureState('g-xmas'), mood: 'content' };
  const spawn = createSpawn({ guildId: 'g-xmas', channelId: 'c', variant: 'normal', expiresInMs: 60_000 });
  const payload = await buildSpawnPayload(state, spawn, { now: at('2026-12-20T12:00:00Z') });
  const rows = payload.components.map((r) => r.toJSON());
  assert.equal(rows[1].components[0].custom_id, `peaches:unwrap:${spawn.id}`);
  assert.match(payload.embeds[0].data.title, /^🎄/);
  assert.match(payload.embeds[0].data.description, /presents/);
});

test('unwrapping: one present per person per visit', async () => {
  ensureState('g-gift');
  const spawn = createSpawn({ guildId: 'g-gift', channelId: 'c', variant: 'frosty', expiresInMs: 60_000 });
  const open = async (userId) => {
    const replies = [];
    await eventButtons.unwrap({ guildId: 'g-gift', user: { id: userId, displayName: userId, toString: () => `<@${userId}>` }, reply: async (p) => replies.push(p) }, spawn.id);
    return replies[0];
  };
  assert.match((await open('kid')).embeds[0].data.title, /present|Coal/);
  assert.equal((await open('kid')).ephemeral, true);
  assert.equal((await open('trickortreat-is-separate')).ephemeral, undefined);
});

test('shop menu and collectibles fit in every season', () => {
  for (const season of [null, ...Object.keys(SEASONS)]) {
    assert.ok(itemsForSale(season).length <= 25, `${season} shop fits one select menu`);
    assert.ok(findableItems(season).length > 0);
  }
  assert.ok(findableItems('winter').some((i) => i.season === 'winter'));
});
