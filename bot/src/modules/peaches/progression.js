/**
 * Peaches' level and quiet hours — pure functions (no DB/Discord) so the
 * curves and timezone math can be unit-tested directly.
 */

/** XP each care action is worth. Sleep is cheap: it's the low-effort button. */
export const ACTION_XP = { feed: 3, water: 3, play: 4, clean: 4, sleep: 1 };

export const MAX_LEVEL = 50;

/** Total XP needed to reach `level` — a gentle quadratic: L2 at 20, L3 at 60, L5 at 200, L10 at 900. */
export function xpForLevel(level) {
  return 10 * (level - 1) * level;
}

export function levelForXp(xp) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level += 1;
  return level;
}

/** { level, into, needed } — progress through the current level, for a progress bar. */
export function levelProgress(xp) {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, needed: 0 };
  const floor = xpForLevel(level);
  return { level, into: xp - floor, needed: xpForLevel(level + 1) - floor };
}

const TITLES = [
  [1, 'Sewer Pup'],
  [3, 'Gutter Scout'],
  [5, 'Crumb Collector'],
  [8, 'Alley Regular'],
  [12, 'Cheese Connoisseur'],
  [17, 'Tunnel Boss'],
  [23, 'Pack Leader'],
  [30, 'Sewer Royalty'],
  [40, 'Rat Legend'],
  [50, 'Eternal Queen of the Rats'],
];

export function titleForLevel(level) {
  let title = TITLES[0][1];
  for (const [min, name] of TITLES) if (level >= min) title = name;
  return title;
}

export const QUIET_START_HOUR = 23;
export const QUIET_END_HOUR = 8;

/** The hour (0-23) it currently is in `timeZone`; falls back to UTC for an invalid zone. */
export function localHour(date, timeZone) {
  const format = (tz) => Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(date));
  try {
    return format(timeZone || 'UTC');
  } catch {
    return format('UTC');
  }
}

/** True overnight (23:00–07:59) in the guild's local time. */
export function isQuietHours(date, timeZone) {
  const hour = localHour(date, timeZone);
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/** "▰▰▰▱▱▱▱▱▱▱" style meter for a 0-100 stat. */
export function statBar(value, length = 10) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * length);
  return '▰'.repeat(filled) + '▱'.repeat(length - filled);
}
