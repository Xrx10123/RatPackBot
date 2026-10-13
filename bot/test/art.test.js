import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMediaForMoment, bundledMoments, BUNDLED_DIR } from '../src/modules/peaches/media.js';
import { MOOD_DISPLAY, VARIANTS } from '../src/modules/peaches/variants.js';
import { SEASONS } from '../src/modules/peaches/seasons.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
}

/** Every moment key the bot can request a picture for. */
function requestedMoments() {
  const keys = new Set([
    ...Object.keys(MOOD_DISPLAY),
    ...Object.keys(VARIANTS).filter((v) => v !== 'normal'),
    ...Object.values(SEASONS).map((s) => s.media),
    'feed', 'water', 'play', 'sleep', 'clean', 'birthday',
  ]);
  for (const file of walk(SRC)) {
    for (const m of readFileSync(file, 'utf8').matchAll(/getMediaForMoment\('([a-z_]+)'\)/g)) keys.add(m[1]);
  }
  return [...keys].sort();
}

test('every moment that shows Peaches has matching built-in art', () => {
  const missing = requestedMoments().filter((key) => getMediaForMoment(key)?.filePath?.startsWith(BUNDLED_DIR) !== true);
  assert.deepEqual(missing, []);
});

test('the art set is uniform: same size, animated, looping GIFs', () => {
  const moments = bundledMoments();
  assert.ok(moments.length >= 27);
  for (const name of moments) {
    const buf = readFileSync(path.join(BUNDLED_DIR, `${name}.gif`));
    assert.equal(buf.toString('ascii', 0, 6), 'GIF89a', name);
    assert.deepEqual([buf.readUInt16LE(6), buf.readUInt16LE(8)], [384, 288], `${name} size`);
    assert.ok(buf.includes(Buffer.from('NETSCAPE2.0')), `${name} loops`);
    const frames = buf.toString('latin1').split('\x21\xf9\x04').length - 1; // graphic control extensions
    assert.ok(frames >= 8, `${name} is animated (${frames} frames)`);
    assert.ok(buf.length < 400 * 1024, `${name} is small enough to attach quickly`);
  }
});

test('no stock clips or remote media left anywhere in the bot', () => {
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /tenor\.com|giphy\.com/i, path.relative(SRC, file));
  }
});

test('unknown or unsafe keys get nothing; normal spawns fall back to mood art', () => {
  assert.equal(getMediaForMoment('normal'), null);
  assert.equal(getMediaForMoment('../../etc/passwd'), null);
  assert.equal(getMediaForMoment(''), null);
});

test('a picture in the override folder wins over the built-in art', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'peaches-override-'));
  writeFileSync(path.join(dir, 'feed.png'), 'not really a png');
  process.env.PEACHES_IMAGE_DIR = dir;
  try {
    assert.equal(getMediaForMoment('feed').filePath, path.join(dir, 'feed.png'));
    assert.ok(getMediaForMoment('water').filePath.startsWith(BUNDLED_DIR));
  } finally {
    delete process.env.PEACHES_IMAGE_DIR;
  }
});
