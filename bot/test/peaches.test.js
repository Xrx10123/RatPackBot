import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMood, ensureState, getCurrentState, applyInteraction } from '../src/modules/peaches/state.js';
import { createSpawn } from '../src/modules/peaches/spawns.js';
import { incrementStat, getLeaderboard } from '../src/modules/peaches/stats.js';

const all = (v) => ({ hunger: v, thirst: v, happiness: v, energy: v, cleanliness: v });

test('calculateMood thresholds', () => {
  assert.equal(calculateMood(all(80), 0), 'thriving');
  assert.equal(calculateMood(all(50), 0), 'content');
  assert.equal(calculateMood({ ...all(50), hunger: 20 }, 0), 'restless');
  assert.equal(calculateMood({ ...all(50), hunger: 20, thirst: 20 }, 0), 'grumpy');
  assert.equal(calculateMood(all(5), 72), 'neglected');
  assert.equal(calculateMood(all(5), 1), 'grumpy', 'needs both low stats and long neglect');
});

test('interactions clamp to 100 and scale only positive effects', () => {
  const guildId = 'g-peach';
  ensureState(guildId);
  const spawn = createSpawn({ guildId, channelId: 'c', variant: 'queen', expiresInMs: 60_000 });
  const before = getCurrentState(guildId);
  const after = applyInteraction(guildId, spawn.id, 'u1', 'play', 2);
  assert.ok(after.happiness <= 100);
  // play costs 15 energy regardless of the queen's 2x multiplier
  assert.ok(Math.abs(before.energy - 15 - after.energy) < 0.1);
});

test('leaderboard leaves out people with zero in that category', () => {
  incrementStat('g-lb', 'fed', 'feed');
  incrementStat('g-lb', 'cleaner', 'clean');
  assert.deepEqual(getLeaderboard('g-lb', 'cheeseFed').map((r) => r.userId), ['fed']);
});

import { xpForLevel, levelForXp, levelProgress, titleForLevel, isQuietHours, statBar, MAX_LEVEL } from '../src/modules/peaches/progression.js';
import { getCareXp, syncLevel, getActionCooldownRemaining } from '../src/modules/peaches/state.js';
import { isSleepingNow, updatePeachesConfig } from '../src/modules/peaches/config.js';
import { updateGuildConfig } from '../src/core/guildConfig.js';

test('level curve is monotonic and round-trips', () => {
  assert.equal(levelForXp(0), 1);
  for (let level = 2; level <= MAX_LEVEL; level++) {
    assert.ok(xpForLevel(level) > xpForLevel(level - 1));
    assert.equal(levelForXp(xpForLevel(level)), level);
    assert.equal(levelForXp(xpForLevel(level) - 1), level - 1);
  }
  assert.equal(levelForXp(10 ** 9), MAX_LEVEL);
  assert.deepEqual(levelProgress(xpForLevel(3) + 5), { level: 3, into: 5, needed: xpForLevel(4) - xpForLevel(3) });
  assert.equal(titleForLevel(1), 'Sewer Pup');
  assert.equal(titleForLevel(MAX_LEVEL), 'Eternal Queen of the Rats');
});

test('statBar', () => {
  assert.equal(statBar(0), '▱'.repeat(10));
  assert.equal(statBar(100), '▰'.repeat(10));
  assert.equal(statBar(150).length, 10);
});

test('quiet hours follow the guild timezone', () => {
  const at = (iso) => new Date(iso);
  assert.equal(isQuietHours(at('2026-10-13T03:00:00Z'), 'UTC'), true);
  assert.equal(isQuietHours(at('2026-10-13T12:00:00Z'), 'UTC'), false);
  // 12:00 UTC is 21:00 in Tokyo (awake) and 23:00 the same moment in Auckland (NZDT, asleep)
  assert.equal(isQuietHours(at('2026-10-13T12:00:00Z'), 'Asia/Tokyo'), false);
  assert.equal(isQuietHours(at('2026-10-13T11:00:00Z'), 'Pacific/Auckland'), true);
  assert.equal(isQuietHours(at('2026-10-13T12:00:00Z'), 'Not/AZone'), false, 'bad zone falls back to UTC');
});

test('isSleepingNow respects the per-guild toggle', () => {
  updateGuildConfig('g-sleep', { timezone: 'UTC' });
  const night = new Date('2026-10-13T02:00:00Z');
  assert.equal(isSleepingNow('g-sleep', night), true);
  updatePeachesConfig('g-sleep', { quietHours: 0 });
  assert.equal(isSleepingNow('g-sleep', night), false);
});

test('care XP accumulates per guild and drives the stored level', () => {
  const guildId = 'g-xp';
  ensureState(guildId);
  const spawn = createSpawn({ guildId, channelId: 'c', variant: 'normal', expiresInMs: 60_000 });
  for (let i = 0; i < 7; i++) applyInteraction(guildId, spawn.id, `user${i}`, 'feed'); // 7 × 3 XP
  assert.equal(getCareXp(guildId), 21);
  assert.equal(getCareXp('some-other-guild'), 0);
  const { level, leveledUp } = syncLevel(guildId);
  assert.equal(level, 2);
  assert.equal(leveledUp, true);
  assert.equal(syncLevel(guildId).leveledUp, false, 'only announces once');
});

test('sleep has a cooldown now (it earns XP)', () => {
  const guildId = 'g-nap';
  ensureState(guildId);
  const spawn = createSpawn({ guildId, channelId: 'c', variant: 'normal', expiresInMs: 60_000 });
  applyInteraction(guildId, spawn.id, 'napper', 'sleep');
  assert.ok(getActionCooldownRemaining(guildId, 'napper', 'sleep') > 0);
});
