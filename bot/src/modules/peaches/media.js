import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AttachmentBuilder } from 'discord.js';
import { config } from '../../config.js';

/**
 * Every picture of Peaches comes from one matching, original art set
 * (bot/assets/peaches/<moment>.gif, drawn by bot/tools/draw_peaches.py), so
 * she looks the same everywhere: moods, visitor variants, care actions,
 * mischief and events. Nothing is downloaded at runtime.
 *
 * To swap in your own picture for a moment, drop e.g. `angry.png` or
 * `feed.gif` into PEACHES_IMAGE_DIR (default ./data/peaches-images) — a file
 * there always wins over the built-in art.
 */
const overrideDir = () => process.env.PEACHES_IMAGE_DIR || config.peaches.imageDir;
export const BUNDLED_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets', 'peaches');
const EXTENSIONS = ['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm'];

/** Every moment that has built-in art (e.g. 'feed', 'grumpy', 'halloween'). */
export function bundledMoments() {
  if (!existsSync(BUNDLED_DIR)) return [];
  return readdirSync(BUNDLED_DIR)
    .filter((f) => f.endsWith('.gif') && !f.startsWith('_'))
    .map((f) => f.slice(0, -4))
    .sort();
}

function findIn(dir, key) {
  for (const ext of EXTENSIONS) {
    const filePath = path.join(dir, `${key}.${ext}`);
    if (existsSync(filePath)) return filePath;
  }
  return null;
}

/** The picture for a moment: your override if there is one, otherwise the built-in art, otherwise null. */
export function getMediaForMoment(key) {
  if (!key || !/^[a-z0-9_-]+$/i.test(key)) return null;
  const filePath = findIn(overrideDir(), key) ?? findIn(BUNDLED_DIR, key);
  return filePath ? { type: 'file', filePath } : null;
}

/**
 * Attaches the picture to a message payload and shows it as the embed's
 * image, so the embed, its buttons and the animation are all one message.
 */
export async function applyMedia(payload, media) {
  if (!media?.filePath) return payload;

  // Re-rendering a message (e.g. a spawn after someone feeds her) must
  // replace the old attachment, not stack another one on top of it.
  payload.attachments = [];

  const filename = path.basename(media.filePath);
  payload.files = [...(payload.files ?? []), new AttachmentBuilder(media.filePath, { name: filename })];
  if (!VIDEO_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext)) && payload.embeds?.[0]) {
    payload.embeds[0].setImage(`attachment://${filename}`);
  }
  return payload;
}
