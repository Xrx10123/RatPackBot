/**
 * Seasonal events. Dates are checked in each server's own timezone (from
 * /setup), so Halloween starts at local midnight, not UTC midnight.
 *
 * Set PEACHES_FORCE_SEASON=halloween in .env to preview a season out of
 * its dates (handy for testing); leave it unset normally.
 */

export const SEASONS = {
  valentines: {
    label: "Valentine's",
    emoji: '💘',
    color: 0xff6fa5,
    start: [2, 7],
    end: [2, 14],
    costume: ['is wearing a heart headband. It bobs when she walks.', 'has written you a valentine. It just says "cheese?"', 'is blushing. Or she ate something red. Hard to say.'],
    statusLine: '💘 She\'s in her heart headband for Valentine\'s.',
    media: 'valentines',
    button: { action: 'valentine', emoji: '💌', label: 'Get a valentine!', hint: '💌 She\'s handing out valentines — one each per visit.' },
  },
  spring: {
    label: 'Spring',
    emoji: '🌷',
    color: 0x9be37a,
    start: [3, 20],
    end: [4, 20],
    costume: ['is wearing a flower crown she made herself. It has dandelions in it.', 'has been rolling around in the grass. She is very happy about it.', 'smells faintly of daisies.'],
    statusLine: '🌷 She\'s in her flower crown for spring.',
    media: 'spring',
    button: { action: 'egghunt', emoji: '🥚', label: 'Egg hunt!', hint: '🥚 She\'s hidden eggs around here — one search each per visit.' },
  },
  summer: {
    label: 'Summer',
    emoji: '☀️',
    color: 0x3fb7e8,
    start: [7, 1],
    end: [8, 31],
    costume: ['is wearing a straw sun hat with a flower on it.', 'has sunscreen on her nose. Just her nose.', 'is fanning herself with a cracker.'],
    statusLine: '☀️ She\'s in her sun hat for summer.',
    media: 'summer',
    button: { action: 'icecream', emoji: '🍦', label: 'Ice cream!', hint: '🍦 She\'s running an ice cream stand — one scoop each per visit.' },
  },
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
    // The extra button on every spawn during this season (handled in handlers/eventButtons.js).
    button: { action: 'trickortreat', emoji: '🎃', label: 'Trick or Treat!', hint: '🍬 Trick or treat? Everyone gets one knock per visit.' },
  },
  winter: {
    label: 'Winter',
    emoji: '🎄',
    color: 0x2e8b57,
    start: [12, 1],
    end: [12, 31],
    costume: ['is wearing a Santa hat three sizes too big.', 'has wrapped presents. They are all cheese. You can tell from the shape.', 'is humming something festive and slightly off-key.'],
    statusLine: '🎅 She\'s in her Santa hat for the holidays.',
    media: 'winter',
    button: { action: 'unwrap', emoji: '🎁', label: 'Unwrap a present!', hint: '🎁 She\'s left presents under the tree — one each per visit.' },
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
