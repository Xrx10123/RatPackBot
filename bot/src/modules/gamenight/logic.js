/** Pure game-night logic — no Discord, no DB. */

const DAY_MS = 86_400_000;

/** Games that work for `players` people (null bounds = no limit). With no count, everything fits. */
export function fitsPlayers(game, players) {
  if (!players) return true;
  if (game.minPlayers != null && players < game.minPlayers) return false;
  if (game.maxPlayers != null && players > game.maxPlayers) return false;
  return true;
}

/**
 * How much the picker favours a game: never-played and long-unplayed games
 * come up more, last night's game rarely repeats.
 */
export function freshnessWeight(game, now = Date.now()) {
  if (!game.lastPlayedAt) return 8;
  const days = (now - game.lastPlayedAt) / DAY_MS;
  return Math.min(8, 0.5 + days);
}

export function weightedPick(games, { now = Date.now(), random = Math.random, exclude = null } = {}) {
  const pool = games.length > 1 && exclude ? games.filter((g) => g.id !== exclude) : games;
  if (pool.length === 0) return null;
  const weights = pool.map((g) => freshnessWeight(g, now));
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    if (roll < weights[i]) return pool[i];
    roll -= weights[i];
  }
  return pool.at(-1);
}

/** Up to `count` distinct games for a vote, freshest-weighted, in random order. */
export function pickPollOptions(games, count = 5, { now = Date.now(), random = Math.random } = {}) {
  const remaining = [...games];
  const chosen = [];
  while (chosen.length < count && remaining.length > 0) {
    const game = weightedPick(remaining, { now, random });
    chosen.push(game);
    remaining.splice(remaining.indexOf(game), 1);
  }
  return chosen;
}

export function shuffle(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffles players into `teamCount` teams as evenly as possible (sizes differ by at most one). */
export function splitTeams(players, teamCount, random = Math.random) {
  const teams = Array.from({ length: teamCount }, () => []);
  shuffle(players, random).forEach((p, i) => teams[i % teamCount].push(p));
  return shuffle(teams, random); // so the bigger teams aren't always first
}

/** Winner of a poll: most votes; ties broken at random. Returns { index, tally, tied }. */
export function tallyPoll(optionCount, votes, random = Math.random) {
  const tally = Array(optionCount).fill(0);
  for (const choice of Object.values(votes)) if (Number.isInteger(choice) && choice >= 0 && choice < optionCount) tally[choice] += 1;
  const best = Math.max(...tally);
  const leaders = tally.map((v, i) => [v, i]).filter(([v]) => v === best).map(([, i]) => i);
  return { index: best === 0 ? null : leaders[Math.floor(random() * leaders.length)], tally, tied: best > 0 && leaders.length > 1 };
}

export function playerRange(game) {
  const { minPlayers: min, maxPlayers: max } = game;
  if (min == null && max == null) return '';
  if (min != null && max != null) return min === max ? `${min} players` : `${min}–${max} players`;
  return min != null ? `${min}+ players` : `up to ${max} players`;
}

export const TEAM_NAMES = ['🧀 Team Cheddar', '🍑 Team Peach', '🐀 Team Whiskers', '🌙 Team Midnight', '🔥 Team Spicy', '❄️ Team Frosty'];
