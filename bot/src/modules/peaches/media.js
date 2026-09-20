import { existsSync } from 'node:fs';
import path from 'node:path';
import { AttachmentBuilder } from 'discord.js';
import { config } from '../../config.js';

// Per the build plan's own Open Question #5: "Peaches image assets... will
// need a small curated set of placeholder images or a folder she can drop
// PNGs into." This is that folder — drop e.g. "angry.png" or "angry.gif" in
// here and it overrides the built-in default below for that moment.
const IMAGE_ASSETS_DIR = config.peaches.imageDir;
const LOCAL_EXTENSIONS = ['png', 'gif', 'jpg', 'jpeg', 'webp', 'mp4', 'webm'];

// Built-in defaults so Peaches has personality out of the box without any
// setup. Add more moment keys here as they're curated.
// Every URL below was pulled live from Tenor's real CDN and verified with an
// HTTP HEAD check (200, video/mp4, real byte length) during development —
// none of these are guessed, since a wrong Tenor ID just 404s.
const DEFAULT_MEDIA_URLS = {
  // moods
  thriving: 'https://media.tenor.com/LFYDDviSFsQAAAP1/mouse-dancing.mp4',
  content: 'https://media.tenor.com/DWOoRNV1SLwAAAPo/adorable-cat-rat-super-cute-duper-one-rat.mp4',
  grumpy: 'https://media.tenor.com/--v1TfbO1IwAAAP1/grumpy-mouse-no.mp4',
  neglected: 'https://media.tenor.com/QyUSDDNydgUAAAP1/rat-cry-mouse-cutie.mp4',
  // spawn variants
  angry: 'https://media.tenor.com/7pAPofH8UWIAAAPo/rat-angry.mp4',
  fancy: 'https://media.tenor.com/5fOz52G1vgIAAAPo/mouse-pimp.mp4',
  sneaky: 'https://media.tenor.com/NC2fU893IrUAAAPo/hamster-stalker.mp4',
  queen: 'https://media.tenor.com/il6wbdeqGYsAAAPo/king-mouse-crowned.mp4',
  // interaction actions
  feed: 'https://media.tenor.com/U8StXwwwUmsAAAPo/rat-rat-eating.mp4',
  water: 'https://media.tenor.com/NnuifmB3R7AAAAPo/mouse-drinking-water-mouse-drinking.mp4',
  play: 'https://media.tenor.com/4N1BYrlMJkMAAAP1/rat-funny.mp4',
  sleep: 'https://media.tenor.com/e6hc3oWottcAAAP1/sleeping-rat-viralhog.mp4',
  clean: 'https://media.tenor.com/LhmDFb7DdWAAAAPo/rat-bath.mp4',
  // mischief
  turd: 'https://media.tenor.com/GE7aR9ZUmrQAAAP1/poop-emoji.mp4',
  hole: 'https://media.tenor.com/OOO17XPzj_UAAAP1/stare-rat.mp4',
  gift: 'https://media.tenor.com/nN6SY3m3MwoAAAPo/gift.mp4',
};

const VIDEO_EXTENSIONS = ['.mp4', '.webm'];
const isVideo = (s) => VIDEO_EXTENSIONS.some((ext) => s.toLowerCase().includes(ext));

function findLocalAsset(key) {
  for (const ext of LOCAL_EXTENSIONS) {
    const filePath = path.join(IMAGE_ASSETS_DIR, `${key}.${ext}`);
    if (existsSync(filePath)) return filePath;
  }
  return null;
}

/** Local folder always wins over the built-in default for a given moment key. */
export function getMediaForMoment(key) {
  const localPath = findLocalAsset(key);
  if (localPath) return { type: 'file', filePath: localPath };
  if (DEFAULT_MEDIA_URLS[key]) return { type: 'url', url: DEFAULT_MEDIA_URLS[key] };
  return null;
}

/**
 * Mutates payload in place to attach media, matching how Discord actually
 * renders each case: a raw video URL only unfurls into a native player when
 * it's in message content (not inside an embed field); a local video file
 * gets its own native player automatically just by being attached; static
 * images/GIFs render through the embed's image field.
 */
export function applyMedia(payload, media) {
  if (!media) return payload;

  if (media.type === 'file') {
    const filename = path.basename(media.filePath);
    payload.files = [...(payload.files ?? []), new AttachmentBuilder(media.filePath, { name: filename })];
    if (!isVideo(filename) && payload.embeds?.[0]) {
      payload.embeds[0].setImage(`attachment://${filename}`);
    }
    return payload;
  }

  if (media.type === 'url') {
    if (isVideo(media.url)) {
      payload.content = [payload.content, media.url].filter(Boolean).join('\n');
    } else if (payload.embeds?.[0]) {
      payload.embeds[0].setImage(media.url);
    }
  }

  return payload;
}
