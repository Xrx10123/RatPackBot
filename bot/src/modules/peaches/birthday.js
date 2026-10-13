import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { peachesState } from '../../db/schema.js';
import { successEmbed } from '../../core/embeds.js';
import { getGuildConfig } from '../../core/guildConfig.js';
import { logger } from '../../core/logger.js';
import { ensureState, getCurrentState, nudgeStats } from './state.js';
import { getSpawnChannelIds } from './config.js';
import { localDateParts } from './seasons.js';
import { getMediaForMoment, applyMedia } from './media.js';
import { pickLine } from './variants.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CELEBRATE_FROM_HOUR = 9; // don't announce at 12:01 AM

const pad = (n) => String(n).padStart(2, '0');

/** 'MM-DD' and year of a moment, as the date reads in the server's timezone. */
export function birthdayFromDate(date, timeZone) {
  const { year, month, day } = localDateParts(date, timeZone);
  return { birthday: `${pad(month)}-${pad(day)}`, birthYear: year };
}

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The (month, day) the birthday falls on in `year` — Feb 29 birthdays are celebrated Feb 28 in other years. */
function observedIn(birthday, year) {
  const [month, day] = birthday.split('-').map(Number);
  if (month === 2 && day === 29 && !isLeap(year)) return { month: 2, day: 28 };
  return { month, day };
}

/** Pure date math for a stored birthday relative to `now` in `timeZone`. */
export function describeBirthday({ birthday, birthYear }, now, timeZone) {
  const today = localDateParts(now, timeZone);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);

  let year = today.year;
  let next = observedIn(birthday, year);
  if (Date.UTC(year, next.month - 1, next.day) < todayUtc) {
    year += 1;
    next = observedIn(birthday, year);
  }
  const daysUntil = Math.round((Date.UTC(year, next.month - 1, next.day) - todayUtc) / 86_400_000);
  const [month, day] = birthday.split('-').map(Number);

  return {
    birthday,
    birthYear,
    display: `${MONTHS[month - 1]} ${day}`,
    isToday: daysUntil === 0,
    daysUntil,
    turning: year - birthYear, // age on the next (or today's) birthday
    localYear: today.year,
    localHour: today.hour,
  };
}

/**
 * Records her birthday for this server the first time we see it: the day
 * the bot joined (guild.members.me.joinedAt). Never overwritten afterwards.
 */
export function ensureBirthday(guild) {
  const state = ensureState(guild.id);
  if (state.birthday) return state;
  const joinedAt = guild.members?.me?.joinedAt ?? new Date();
  const { birthday, birthYear } = birthdayFromDate(joinedAt, getGuildConfig(guild.id)?.timezone);
  db.update(peachesState).set({ birthday, birthYear }).where(eq(peachesState.guildId, guild.id)).run();
  return { ...state, birthday, birthYear };
}

export function getBirthdayInfo(guildId, now = new Date()) {
  const state = ensureState(guildId);
  if (!state.birthday) return null;
  return describeBirthday(state, now, getGuildConfig(guildId)?.timezone);
}

/** Human line for /pet status. */
export function birthdayStatusLine(info) {
  if (!info) return null;
  if (info.isToday) return info.turning > 0 ? `🎂 **It's her birthday today!** She's ${info.turning}.` : `🎂 Today's the day she moved in!`;
  const when = info.daysUntil === 1 ? 'tomorrow' : `in ${info.daysUntil} days`;
  return `🎂 Birthday: ${info.display} — turns ${info.turning} ${when}`;
}

const CELEBRATIONS = [
  (name, age) => `🎉 It's **${name}'s birthday!** She moved into this server ${age} year${age === 1 ? '' : 's'} ago today and has been causing problems ever since.`,
  (name, age) => `🎂 Happy birthday to **${name}**, ${age} year${age === 1 ? '' : 's'} old today! She has demanded cake. There is cake.`,
  (name, age) => `🥳 Clear the tunnels — **${name}** turns ${age} today! Gifts may be left by the cheese drawer.`,
];

export function buildBirthdayPayload(name, age) {
  const embed = successEmbed({
    title: `🎂 Happy Birthday, ${name}!`,
    description: [pickLine(CELEBRATIONS)(name, age), '', 'Grab a slice of cake below — it goes in your `/pet album`. One slice each!'].join('\n'),
  });
  embed.setColor(0xff8fc7);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('peaches:birthday_cake').setEmoji('🍰').setLabel('Take a slice').setStyle(ButtonStyle.Success),
  );
  return applyMedia({ embeds: [embed], components: [row] }, getMediaForMoment('birthday'));
}

async function celebrateIfDue(client, guild, now) {
  const state = ensureBirthday(guild);
  const info = describeBirthday(state, now, getGuildConfig(guild.id)?.timezone);
  if (!info.isToday || info.turning < 1) return false;
  if (state.lastBirthdayYear === info.localYear || info.localHour < CELEBRATE_FROM_HOUR) return false;

  const [channelId] = getSpawnChannelIds(guild.id);
  const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;
  if (!channel) return false;

  // Mark first so a send failure can't turn into an hourly retry storm.
  db.update(peachesState).set({ lastBirthdayYear: info.localYear }).where(eq(peachesState.guildId, guild.id)).run();
  nudgeStats(guild.id, { happiness: 25 });
  const { name } = getCurrentState(guild.id);
  await channel.send(await buildBirthdayPayload(name, info.turning));
  return true;
}

export async function birthdayTick(client, now = new Date()) {
  for (const guild of client.guilds.cache.values()) {
    await celebrateIfDue(client, guild, now).catch((err) => logger.warn({ err, guildId: guild.id }, 'Peaches birthday check failed'));
  }
}
