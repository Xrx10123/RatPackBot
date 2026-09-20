import { config } from '../config.js';

/** Picks a random line from a pool. Returns '' if flavor text is disabled. */
export function flavor(pool) {
  if (!config.flavorEnabled) return '';
  return pool[Math.floor(Math.random() * pool.length)];
}

// Flavor is garnish, never a blocker — these are appended to functional text,
// never replace it.
export const FLAVOR = {
  nowPlaying: [
    "The rats approve of this selection.",
    "Fresh from the hoard.",
    "Sniffed out and served up.",
  ],
  sourceFallback: [
    "sniffed this out the hard way.",
  ],
  queueAdded: [
    "Added to the hoard's queue.",
    "Tossed onto the pile.",
  ],
};
