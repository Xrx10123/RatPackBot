/**
 * Seasonal events. Dates are checked in each server's own timezone (from
 * /setup), so Halloween starts at local midnight, not UTC midnight.
 *
 * Set PEACHES_FORCE_SEASON=halloween in .env to preview a season out of
 * its dates (handy for testing); leave it unset normally.
 */

export const SEASONS = {
  halloween: {
    label: 'Halloween',
    emoji: '🎃',
    color: 0xff7518,
    // [month, day] inclusive, local time
    start: [10, 15],
    end: [10, 31],
    costume: ['is wearing a tiny witch hat. It does not fit. She does not care.', 'has a pumpkin pail and expectations.', 'is dressed as a very small, very serious witch.'],
    statusLine: '🧙 She\'s in her witch hat for spooky season.',
    media: 'halloween',
  },
};

/** { year, month, day, hour } as the wall clock reads in `timeZone` (UTC if invalid/missing). */
export function localDateParts(date, timeZone) {
  const read = (tz) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
  };
  try {
    return read(timeZone || 'UTC');
  } catch {
    return read('UTC');
  }
}

/** The key of the season active on this date in this timezone, or null. */
export function getActiveSeason(date = new Date(), timeZone = 'UTC') {
  const forced = process.env.PEACHES_FORCE_SEASON;
  if (forced && SEASONS[forced]) return forced;

  const { month, day } = localDateParts(date, timeZone);
  const today = month * 100 + day;
  for (const [key, season] of Object.entries(SEASONS)) {
    const from = season.start[0] * 100 + season.start[1];
    const to = season.end[0] * 100 + season.end[1];
    if (today >= from && today <= to) return key;
  }
  return null;
}
