import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSteamInput } from '../src/modules/games/commands/steam.js';
import { stats } from '../src/modules/games/commands/stats.js';

test('parseSteamInput handles ids, vanity names, and pasted profile URLs', () => {
  assert.deepEqual(parseSteamInput('76561197960287930'), { steamId: '76561197960287930' });
  assert.deepEqual(parseSteamInput('gabelogannewell'), { vanity: 'gabelogannewell' });
  assert.deepEqual(parseSteamInput('https://steamcommunity.com/id/gabelogannewell/'), { vanity: 'gabelogannewell' });
  assert.deepEqual(parseSteamInput('steamcommunity.com/profiles/76561197960287930?l=en'), { steamId: '76561197960287930' });
});

test('/stats username is capped so the refresh customId fits in 100 chars', () => {
  const json = stats.data.toJSON();
  const username = json.options.find((o) => o.name === 'username');
  const longestGame = Math.max(...json.options.find((o) => o.name === 'game').choices.map((c) => c.value.length));
  assert.ok(`games:stats_refresh:${'g'.repeat(longestGame)}:`.length + username.max_length <= 100);
});
