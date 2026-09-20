// Variant mechanics are kept light by design — the plan lists the enum
// (normal|fancy|angry|sneaky|queen) without detailing unique mechanics per
// variant, so each gets a flavor/color/multiplier tweak rather than bespoke
// behavior, matching "normal" being the only one the plan actually describes.
export const VARIANTS = {
  normal: { label: 'Peaches', multiplier: 1, expiresInMs: 15 * 60 * 1000, color: null },
  fancy: { label: 'Fancy Peaches', multiplier: 1.5, expiresInMs: 15 * 60 * 1000, color: 0xffb300, intro: 'is dressed to the nines today.' },
  angry: { label: 'Angry Peaches', multiplier: 0.5, expiresInMs: 15 * 60 * 1000, color: 0xe53935, intro: 'is in a mood. Approach with cheese.' },
  sneaky: { label: 'Sneaky Peaches', multiplier: 1, expiresInMs: 7 * 60 * 1000, color: 0x4a4a4a, intro: "won't stick around long." },
  queen: { label: 'Queen Peaches', multiplier: 2, expiresInMs: 15 * 60 * 1000, color: 0xffd700, intro: 'has graced you with her presence.' },
};

export const MOOD_DISPLAY = {
  thriving: { emoji: '😻', label: 'Thriving', flavor: 'is living her best life.' },
  content: { emoji: '🙂', label: 'Content', flavor: 'is doing fine.' },
  restless: { emoji: '😕', label: 'Restless', flavor: 'keeps staring at the cheese drawer.' },
  grumpy: { emoji: '😾', label: 'Grumpy', flavor: 'has knocked something off a shelf. Deliberately.' },
  neglected: { emoji: '💀', label: 'Neglected', flavor: 'has gone feral. Someone should fix this.' },
};
