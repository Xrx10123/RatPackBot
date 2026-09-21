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
// setup. Each key is a POOL, not a single URL — one URL per key meant the
// same mood/action always showed the identical clip. Add more entries here
// as they're curated.
// Every URL below was pulled live from Tenor's real CDN and verified with an
// HTTP HEAD check (200, video/mp4, real byte length) during development —
// none of these are guessed, since a wrong Tenor ID just 404s.
const DEFAULT_MEDIA_POOLS = {
  // moods
  thriving: [
    'https://media.tenor.com/LFYDDviSFsQAAAP1/mouse-dancing.mp4',
    'https://media.tenor.com/enclWnhB24UAAAP1/love-rat.mp4',
    'https://media.tenor.com/KHpeP1HyGOYAAAP1/mouse-dance.mp4',
  ],
  content: [
    'https://media.tenor.com/DWOoRNV1SLwAAAPo/adorable-cat-rat-super-cute-duper-one-rat.mp4',
    'https://media.tenor.com/yQpgBGK_fSYAAAP1/chillin-chill.mp4',
    'https://media.tenor.com/_h8btWwVYJsAAAP1/hamster-stroking-hamster.mp4',
  ],
  grumpy: [
    'https://media.tenor.com/--v1TfbO1IwAAAP1/grumpy-mouse-no.mp4',
    'https://media.tenor.com/tE-zbe--hDAAAAP1/tiny-and-angry.mp4',
  ],
  restless: [
    'https://media.tenor.com/chqCChbRij0AAAPo/basil-the-great-mouse-detective-fidget.mp4',
    'https://media.tenor.com/fZlLlDjGayUAAAP1/owain-owain-rat.mp4',
    'https://media.tenor.com/dqhn2ugf5c4AAAP1/hamster-biting-hand.mp4',
  ],
  neglected: [
    'https://media.tenor.com/QyUSDDNydgUAAAP1/rat-cry-mouse-cutie.mp4',
    'https://media.tenor.com/fhP2jD1l0e0AAAPo/sad-hampter-hampter.mp4',
  ],
  // spawn variants
  angry: [
    'https://media.tenor.com/7pAPofH8UWIAAAPo/rat-angry.mp4',
    'https://media.tenor.com/jN5rny6kgGsAAAPo/rat-angry.mp4',
  ],
  fancy: [
    'https://media.tenor.com/5fOz52G1vgIAAAPo/mouse-pimp.mp4',
    'https://media.tenor.com/y5v0zvLnTWoAAAP1/rat-fancy-rat.mp4',
    'https://media.tenor.com/QDTp4GuQX2QAAAP1/rat-with-a-sweater-fetish-sweater-rat.mp4',
  ],
  sneaky: [
    'https://media.tenor.com/NC2fU893IrUAAAPo/hamster-stalker.mp4',
    'https://media.tenor.com/l6Rqg34ZLEEAAAP1/caddicarus-sneaking.mp4',
  ],
  queen: [
    'https://media.tenor.com/il6wbdeqGYsAAAPo/king-mouse-crowned.mp4',
    'https://media.tenor.com/KVYvmjgaIicAAAP1/royals-royalty.mp4',
  ],
  // interaction actions
  feed: [
    'https://media.tenor.com/U8StXwwwUmsAAAPo/rat-rat-eating.mp4',
    'https://media.tenor.com/RIAss-5yBksAAAP1/hamster-nom-nom.mp4',
    'https://media.tenor.com/lSy9e7K6TeUAAAP1/mouse-mouse-eat.mp4',
  ],
  water: [
    'https://media.tenor.com/NnuifmB3R7AAAAPo/mouse-drinking-water-mouse-drinking.mp4',
    'https://media.tenor.com/0C9U6uiZnHoAAAPo/drinking-desperate.mp4',
  ],
  play: [
    'https://media.tenor.com/4N1BYrlMJkMAAAP1/rat-funny.mp4',
    'https://media.tenor.com/O1KlBFjvCqwAAAP1/hamsters-wheel.mp4',
  ],
  sleep: [
    'https://media.tenor.com/e6hc3oWottcAAAP1/sleeping-rat-viralhog.mp4',
    'https://media.tenor.com/pfVs8o8gvHAAAAP1/sleep-hamster.mp4',
  ],
  clean: [
    'https://media.tenor.com/LhmDFb7DdWAAAAPo/rat-bath.mp4',
    'https://media.tenor.com/x07ZHj-V46MAAAPo/cute-rats-grooming-kissing-kiss-bonding-friends.mp4',
  ],
  // mischief
  turd: [
    'https://media.tenor.com/GE7aR9ZUmrQAAAP1/poop-emoji.mp4',
    'https://media.tenor.com/wgDKnCWhIPYAAAP1/rats-runny-poop.mp4',
    'https://media.tenor.com/cK5d1RTQBggAAAPo/oops-zhotcita-gif.mp4',
  ],
  hole: [
    'https://media.tenor.com/OOO17XPzj_UAAAP1/stare-rat.mp4',
    'https://media.tenor.com/Nr0zZl5v8LIAAAP1/peek-look.mp4',
    'https://media.tenor.com/UzB_EkTxk9cAAAP1/boggling-rat.mp4',
  ],
  gift: [
    'https://media.tenor.com/nN6SY3m3MwoAAAPo/gift.mp4',
    'https://media.tenor.com/DhuVm5GtFp0AAAPo/just-for-you-mouse.mp4',
    'https://media.tenor.com/ENqTVIga3LYAAAP1/fun-celebration.mp4',
  ],
  // escalation ladder (neglected mood, 48h+) — previously had no media at all
  shred: ['https://media.tenor.com/JdgiRS217bkAAAPo/toilet-paper-toilet.mp4'],
  walls: [
    'https://media.tenor.com/qcYZgqnBjmIAAAP1/im-in-your-walls-jamiroquai.mp4',
    'https://media.tenor.com/_y8hQyqRf1IAAAPo/tom-and-jerry-mouse.mp4',
  ],
  ruler: ['https://media.tenor.com/3BMEPebsAWEAAAPo/king-rat-bar-kingrat.mp4'],
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

/** Local folder always wins over the built-in pool for a given moment key; otherwise picks randomly from the pool. */
export function getMediaForMoment(key) {
  const localPath = findLocalAsset(key);
  if (localPath) return { type: 'file', filePath: localPath };

  const pool = DEFAULT_MEDIA_POOLS[key];
  if (pool?.length > 0) return { type: 'url', url: pool[Math.floor(Math.random() * pool.length)] };
  return null;
}

// Cache downloaded bytes per URL — it's a small fixed set of ~15 curated
// GIFs reused constantly, no reason to re-fetch Tenor every single spawn.
const remoteMediaCache = new Map(); // url -> Buffer

async function fetchRemoteMedia(url) {
  if (remoteMediaCache.has(url)) return remoteMediaCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch media (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  remoteMediaCache.set(url, buffer);
  return buffer;
}

/**
 * Mutates payload in place to attach media as a real file. Discord only
 * renders a native inline video/gif player for an actual attachment, or for
 * a bare unfurled link in a message with NO explicit embed — once a message
 * carries a custom embed (which every one of these does), a plain link in
 * content just renders as blue text instead of unfurling. Downloading the
 * bytes and attaching them keeps the embed, buttons, and a genuinely
 * playing video/gif all in one message.
 */
export async function applyMedia(payload, media) {
  if (!media) return payload;

  // Explicitly clearing `attachments` matters when this payload is used for
  // Message#edit (e.g. re-rendering a spawn after a feed/water/play click):
  // Discord's edit endpoint ADDS new file uploads to whatever's already
  // attached unless the attachment list is explicitly reset, which would
  // otherwise stack a new video onto the message every single click.
  payload.attachments = [];

  if (media.type === 'file') {
    const filename = path.basename(media.filePath);
    payload.files = [...(payload.files ?? []), new AttachmentBuilder(media.filePath, { name: filename })];
    if (!isVideo(filename) && payload.embeds?.[0]) {
      payload.embeds[0].setImage(`attachment://${filename}`);
    }
    return payload;
  }

  if (media.type === 'url') {
    try {
      const buffer = await fetchRemoteMedia(media.url);
      const filename = media.url.split('/').pop().split('?')[0] || 'media.mp4';
      payload.files = [...(payload.files ?? []), new AttachmentBuilder(buffer, { name: filename })];
      if (!isVideo(filename) && payload.embeds?.[0]) {
        payload.embeds[0].setImage(`attachment://${filename}`);
      }
    } catch {
      // media is best-effort flavor — ship the message without it rather than block on a fetch failure
    }
  }

  return payload;
}
