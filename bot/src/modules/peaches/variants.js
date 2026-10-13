// Variant mechanics are kept light by design — the plan lists the enum
// (normal|fancy|angry|sneaky|queen) without detailing unique mechanics per
// variant, so each gets a flavor/color/multiplier tweak rather than bespoke
// behavior, matching "normal" being the only one the plan actually describes.
//
// `intro` and `flavor` (below) are arrays, not single strings — one line
// per mood/variant meant every embed at the same mood showed identical
// text. The plan's own example line is kept as the first entry in each pool.
export const VARIANTS = {
  normal: { label: 'Peaches', multiplier: 1, expiresInMs: 15 * 60 * 1000, color: null },
  fancy: {
    label: 'Fancy Peaches',
    multiplier: 1.5,
    expiresInMs: 15 * 60 * 1000,
    color: 0xffb300,
    intro: ['is dressed to the nines today.', 'is looking particularly sharp.'],
  },
  angry: {
    label: 'Angry Peaches',
    multiplier: 0.5,
    expiresInMs: 15 * 60 * 1000,
    color: 0xe53935,
    intro: ['is in a mood. Approach with cheese.', 'does not want to be bothered right now.'],
  },
  sneaky: {
    label: 'Sneaky Peaches',
    multiplier: 1,
    expiresInMs: 7 * 60 * 1000,
    color: 0x4a4a4a,
    intro: ["won't stick around long.", 'slips in and out before you notice.'],
  },
  queen: {
    label: 'Queen Peaches',
    multiplier: 2,
    expiresInMs: 15 * 60 * 1000,
    color: 0xffd700,
    intro: ['has graced you with her presence.', 'demands your attention, peasant.'],
  },
  // Halloween-only (see spawns.js pickVariant). Shorter-lived and spookier.
  ghost: {
    label: 'Ghost Peaches',
    multiplier: 1.5,
    expiresInMs: 10 * 60 * 1000,
    color: 0xd8d8f0,
    season: 'halloween',
    intro: ['drifts in under a bedsheet. Boo.', 'is haunting this channel. Politely.', 'phases through the wall, rattling a tiny chain.'],
  },
  // Winter-only. Bundled up and in a hurry to get back somewhere warm.
  frosty: {
    label: 'Frosty Peaches',
    multiplier: 1.5,
    expiresInMs: 10 * 60 * 1000,
    color: 0x9fd8ff,
    season: 'winter',
    intro: ['bursts in from the snow, earmuffs askew.', 'has been building a snowman. It looks like her.', 'is shivering dramatically. Hot cocoa would fix this.'],
  },
};

export const MOOD_DISPLAY = {
  thriving: {
    emoji: '😻',
    label: 'Thriving',
    flavor: ['is living her best life.', 'is having an excellent day.', 'is practically glowing right now.'],
  },
  content: {
    emoji: '🙂',
    label: 'Content',
    flavor: ['is doing fine.', 'seems content enough.', 'is going about her business.'],
  },
  restless: {
    emoji: '😕',
    label: 'Restless',
    flavor: ['keeps staring at the cheese drawer.', 'is pacing back and forth.', 'seems a little on edge.'],
  },
  grumpy: {
    emoji: '😾',
    label: 'Grumpy',
    flavor: ['has knocked something off a shelf. Deliberately.', 'is giving everyone the side-eye.', 'is not in the mood for nonsense.'],
  },
  neglected: {
    emoji: '💀',
    label: 'Neglected',
    flavor: ['has gone feral. Someone should fix this.', "hasn't seen a friendly face in a while.", 'is not doing great. This is a cry for help.'],
  },
};

export function pickLine(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}
