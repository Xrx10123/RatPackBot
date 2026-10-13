import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuzzySearch, fuzzyScore, normalizeForMatch } from '../src/utils/fuzzy.js';
import { parseDuration, formatDuration, formatProgressBar } from '../src/utils/format.js';
import { componentText, escapeMarkdown } from '../src/utils/text.js';

test('fuzzyScore: non-subsequence is -1, empty query is 0', () => {
  assert.equal(fuzzyScore('xyz', 'Dead by Daylight'), -1);
  assert.equal(fuzzyScore('', 'anything'), 0);
  assert.ok(fuzzyScore('dbd', 'Dead by Daylight') > 0);
});

test('fuzzySearch: exact match beats a longer name with the same prefix', () => {
  // Regression: the news seed resolved "PEAK" to "Peaky Blinders" on a score tie.
  const apps = [{ name: 'Peaky Blinders: Mastermind' }, { name: 'Peak Angle' }, { name: 'PEAK' }];
  assert.equal(fuzzySearch('PEAK', apps, { key: (a) => a.name })[0].name, 'PEAK');
});

test('fuzzySearch: trademark symbols do not block an exact match', () => {
  const apps = [{ name: 'Overwatch 2 - Soundtrack' }, { name: 'Overwatch® 2' }];
  assert.equal(fuzzySearch('Overwatch 2', apps, { key: (a) => a.name })[0].name, 'Overwatch® 2');
});

test('fuzzySearch: shorter names break remaining ties, limit applies', () => {
  const items = ['abcdef', 'abc', 'abcd'];
  assert.deepEqual(fuzzySearch('ab', items, { limit: 2 }), ['abc', 'abcd']);
  assert.deepEqual(fuzzySearch('', items, { limit: 2 }), ['abcdef', 'abc']);
});

test('normalizeForMatch strips punctuation and case', () => {
  assert.equal(normalizeForMatch('  Tom Clancy’s  Rainbow Six® Siege '), 'tom clancys rainbow six siege');
});

test('parseDuration accepts seconds, m:ss, h:mm:ss', () => {
  assert.equal(parseDuration('90'), 90_000);
  assert.equal(parseDuration('1:30'), 90_000);
  assert.equal(parseDuration('1:02:03'), 3_723_000);
});

test('parseDuration rejects garbage and out-of-range fields', () => {
  for (const bad of ['', 'abc', '1:99', '1:2:3:4', '-5', '1:60']) {
    assert.equal(parseDuration(bad), null, bad);
  }
});

test('formatDuration / formatProgressBar', () => {
  assert.equal(formatDuration(65_000), '1:05');
  assert.equal(formatDuration(3_723_000), '1:02:03');
  assert.equal(formatDuration(NaN), '0:00');
  assert.match(formatProgressBar(30_000, 60_000), /🔘.* 0:30 \/ 1:00$/);
  assert.equal(formatProgressBar(0, 0), '🔴 LIVE');
});

test('componentText never returns empty or >max', () => {
  assert.equal(componentText('', 'Fallback'), 'Fallback');
  assert.equal(componentText('   ', 'Fallback'), 'Fallback');
  assert.equal(componentText(undefined), 'Unknown');
  const long = componentText('x'.repeat(500));
  assert.equal(long.length, 100);
  assert.ok(long.endsWith('…'));
});

test('escapeMarkdown escapes formatting and link brackets', () => {
  assert.equal(escapeMarkdown('**hi** [x](y) _z_'), '\\*\\*hi\\*\\* \\[x\\](y) \\_z\\_');
});
