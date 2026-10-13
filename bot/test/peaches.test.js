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
