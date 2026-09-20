import { config } from '../config.js';

/** Picks a random line from a pool. Returns '' if flavor text is disabled. */
export function flavor(pool) {
  if (!config.flavorEnabled) return '';
  return pool[Math.floor(Math.random() * pool.length)];
}

// Flavor is garnish, never a blocker — these are appended to functional text,
// never replace it. Tone: mischievous, never mean.
export const FLAVOR = {
  nowPlaying: ['The rats approve of this selection.', 'Fresh from the hoard.', 'Sniffed out and served up.', 'Straight from the tunnels to your speakers.'],
  sourceFallback: ["sniffed this out the hard way."],
  queueAdded: ["Added to the hoard's queue.", 'Tossed onto the pile.', 'Filed away for later gnawing.'],
  queueEmpty: ["The hoard's queue is bare.", 'Nothing left to sniff out.', "The rats have run out of tunes."],
  stopped: ['Silence in the sewers.', 'The rats have stopped digging.'],
  shuffled: ['Scattered like crumbs.', 'The hoard is thoroughly rearranged.'],
  skipped: ['On to the next one.', 'That one went in the discard pile.'],
  playlistSaved: ['Safely tucked into the hoard.', 'Filed for safekeeping.'],
  searchEmpty: ['Not a whisker of a result.', 'The tunnels came up empty.'],
};
