import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { memberBirthdays, birthdayWishes } from '../../db/schema.js';

/**
 * Member birthdays. Date math is pure and tested; "today" is always the
 * server's local date (timezone from /setup).
 */

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // Feb 29 allowed

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function isValidBirthday(month, day, year = null) {
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1 || day > DAYS_IN_MONTH[month - 1]) return false;
  if (year != null) {
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getUTCFullYear()) return false;
    if (month === 2 && day === 29 && !isLeap(year)) return false;
  }
  return true;
}

/** Feb 29 birthdays are celebrated on Feb 28 in non-leap years. */
export function observedDay(month, day, year) {
  return month === 2 && day === 29 && !isLeap(year) ? 28 : day;
}

export function isBirthdayOn(row, { year, month, day }) {
  return row.month === month && observedDay(row.month, row.day, year) === day;
}

/** Days from the local date `today` until this birthday next comes round (0 = today). */
export function daysUntilBirthday(row, today) {
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  for (const year of [today.year, today.year + 1]) {
    const at = Date.UTC(year, row.month - 1, observedDay(row.month, row.day, year));
    if (at >= todayUtc) return Math.round((at - todayUtc) / 86_400_000);
  }
  return 365;
}

export function formatBirthday(row, { withYear = false } = {}) {
  return `${MONTHS[row.month - 1]} ${row.day}${withYear && row.year ? `, ${row.year}` : ''}`;
}

export function ageOn(row, year) {
  return row.year ? year - row.year : null;
}

// --- storage --------------------------------------------------------------

export function setBirthday(guildId, userId, { month, day, year = null }) {
  db.insert(memberBirthdays)
    .values({ guildId, userId, month, day, year })
    .onConflictDoUpdate({ target: [memberBirthdays.guildId, memberBirthdays.userId], set: { month, day, year } })
    .run();
}

export function removeBirthday(guildId, userId) {
  return db.delete(memberBirthdays).where(and(eq(memberBirthdays.guildId, guildId), eq(memberBirthdays.userId, userId))).run().changes > 0;
}

export function getBirthday(guildId, userId) {
  return db.select().from(memberBirthdays).where(and(eq(memberBirthdays.guildId, guildId), eq(memberBirthdays.userId, userId))).get() ?? null;
}

export function listBirthdays(guildId) {
  return db.select().from(memberBirthdays).where(eq(memberBirthdays.guildId, guildId)).all();
}

export function markCelebrated(guildId, userId, year, { roleGranted = false } = {}) {
  db.update(memberBirthdays)
    .set({ lastCelebratedYear: year, ...(roleGranted ? { roleGrantedAt: Date.now() } : {}) })
    .where(and(eq(memberBirthdays.guildId, guildId), eq(memberBirthdays.userId, userId)))
    .run();
}

/** Birthday roles handed out more than `olderThanMs` ago — time to take them back. */
export function listExpiredRoles(olderThanMs, now = Date.now()) {
  return db
    .select()
    .from(memberBirthdays)
    .where(and(isNotNull(memberBirthdays.roleGrantedAt), lt(memberBirthdays.roleGrantedAt, now - olderThanMs)))
    .all();
}

export function clearRoleGrant(guildId, userId) {
  db.update(memberBirthdays).set({ roleGrantedAt: null }).where(and(eq(memberBirthdays.guildId, guildId), eq(memberBirthdays.userId, userId))).run();
}

/** Records a wish. Returns false if this person already wished them this year. */
export function addWish(guildId, birthdayUserId, year, wisherId) {
  return db.insert(birthdayWishes).values({ guildId, birthdayUserId, year, wisherId }).onConflictDoNothing().run().changes > 0;
}

export function countWishes(guildId, birthdayUserId, year) {
  return db
    .select()
    .from(birthdayWishes)
    .where(and(eq(birthdayWishes.guildId, guildId), eq(birthdayWishes.birthdayUserId, birthdayUserId), eq(birthdayWishes.year, year)))
    .all().length;
}
