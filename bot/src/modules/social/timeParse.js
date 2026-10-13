/**
 * Turns what people type into /remind ("in 2h", "at 9pm", "tomorrow 8:30am")
 * into a moment in time. Clock times are read in the server's timezone
 * (from /setup), so "at 9pm" means 9pm where your friends are.
 */

const UNIT_MS = {
  s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000,
  m: 60_000, min: 60_000, mins: 60_000, minute: 60_000, minutes: 60_000,
  h: 3_600_000, hr: 3_600_000, hrs: 3_600_000, hour: 3_600_000, hours: 3_600_000,
  d: 86_400_000, day: 86_400_000, days: 86_400_000,
  w: 604_800_000, week: 604_800_000, weeks: 604_800_000,
  mo: 2_592_000_000, month: 2_592_000_000, months: 2_592_000_000,
  y: 31_536_000_000, yr: 31_536_000_000, year: 31_536_000_000, years: 31_536_000_000,
};

export const MIN_DELAY_MS = 60_000;
export const MAX_DELAY_MS = 365 * 86_400_000;

/** Wall-clock parts of `date` in `timeZone`. */
export function wallClock(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** How far `timeZone` is ahead of UTC at `date`, in ms. */
function offsetMs(date, timeZone) {
  const w = wallClock(date, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - (date.getTime() - date.getMilliseconds());
}

/** The UTC moment when the clock in `timeZone` reads the given wall time (DST-aware). */
export function zonedTimeToUtc({ year, month, day, hour, minute }, timeZone) {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  let guess = asUtc - offsetMs(new Date(asUtc), timeZone);
  guess = asUtc - offsetMs(new Date(guess), timeZone); // second pass settles DST edges
  return new Date(guess);
}

function validZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * @returns {{ date: Date } | { error: string }}
 */
export function parseWhen(input, now = new Date(), timeZone = 'UTC') {
  const tz = validZone(timeZone || 'UTC');
  let text = String(input ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return { error: 'Tell me when — like `in 2h`, `at 9pm`, or `tomorrow 8:30am`.' };

  // Relative: "in 2h 30m", "2 hours", "90 minutes", "1d"
  const relative = text.replace(/^in /, '').replace(/ and /g, ' ').replace(/,/g, ' ');
  const pieces = [...relative.matchAll(/(\d+(?:\.\d+)?) ?([a-z]+)/g)];
  if (pieces.length > 0 && pieces.map((m) => m[0]).join(' ').replace(/ /g, '') === relative.replace(/ /g, '')) {
    let total = 0;
    for (const [, amount, unit] of pieces) {
      if (!UNIT_MS[unit]) return { error: `I don't know the unit "${unit}". Try minutes, hours, days or weeks.` };
      total += Number(amount) * UNIT_MS[unit];
    }
    return checkRange(new Date(now.getTime() + total), now);
  }

  // Absolute: "[today|tomorrow] [at] 9pm", "at 21:30", "tomorrow at 8:15 am"
  let dayOffset = 0;
  if (text.startsWith('tomorrow')) {
    dayOffset = 1;
    text = text.slice('tomorrow'.length).trim();
  } else if (text.startsWith('today')) {
    text = text.slice('today'.length).trim();
  } else if (text.startsWith('tonight')) {
    text = text.slice('tonight'.length).trim();
  }
  text = text.replace(/^at /, '');
  if (text === '' && dayOffset === 1) text = '9am'; // "tomorrow" alone → tomorrow morning

  const clock = text.match(/^(\d{1,2})(?::(\d{2}))? ?(am|pm)?$/) ?? (text === 'noon' ? ['', '12', '00', 'pm'] : text === 'midnight' ? ['', '12', '00', 'am'] : null);
  if (!clock) return { error: 'I couldn\'t read that time. Try `in 2h`, `in 45 minutes`, `at 9pm`, `at 21:30` or `tomorrow 8am`.' };

  let hour = Number(clock[1]);
  const minute = Number(clock[2] ?? 0);
  const meridiem = clock[3];
  if (minute > 59 || hour > 23 || (meridiem && (hour < 1 || hour > 12))) return { error: 'That doesn\'t look like a real time of day.' };
  if (meridiem === 'pm' && hour !== 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;

  const today = wallClock(now, tz);
  const base = new Date(Date.UTC(today.year, today.month - 1, today.day + dayOffset));
  let date = zonedTimeToUtc({ year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate(), hour, minute }, tz);
  // "at 9am" when it's already 10am means tomorrow.
  if (dayOffset === 0 && date <= now) {
    const next = new Date(base.getTime() + 86_400_000);
    date = zonedTimeToUtc({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hour, minute }, tz);
  }
  return checkRange(date, now);
}

function checkRange(date, now) {
  const delay = date.getTime() - now.getTime();
  if (!Number.isFinite(delay)) return { error: 'That doesn\'t look like a time.' };
  if (delay < MIN_DELAY_MS) return { error: 'That\'s less than a minute away — you can probably remember that yourself!' };
  if (delay > MAX_DELAY_MS) return { error: 'I can only remember things up to a year ahead. Peaches has a very small brain.' };
  return { date };
}
