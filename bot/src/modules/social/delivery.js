import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed, infoEmbed } from '../../core/embeds.js';
import { getGuildConfig } from '../../core/guildConfig.js';
import { logger } from '../../core/logger.js';
import { componentText } from '../../utils/text.js';
import { wallClock } from './timeParse.js';
import { peachesName, giftCheese } from '../../core/peachesVoice.js';
import { listBirthdays, isBirthdayOn, ageOn, markCelebrated, listExpiredRoles, clearRoleGrant } from './birthdays.js';
import { dueReminders, claimReminder } from './reminders.js';

export const BIRTHDAY_GIFT = 25;
export const BIRTHDAY_ROLE_MS = 24 * 60 * 60 * 1000;
const LATE_NOTE_MS = 3 * 60 * 1000;
const BIRTHDAY_ART = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets', 'peaches', 'birthday.gif');

function zoneOf(guildId) {
  const tz = getGuildConfig(guildId)?.timezone || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

async function socialChannel(client, guildId) {
  const id = getGuildConfig(guildId)?.socialChannelId;
  const channel = id ? await client.channels.fetch(id).catch(() => null) : null;
  return channel?.isTextBased?.() ? channel : null;
}

const BIRTHDAY_LINES = [
  (n) => `${n} has baked a cake. It is mostly cheese. Nobody is complaining.`,
  (n) => `${n} has been hiding party hats in the walls for weeks for this exact moment.`,
  (n) => `${n} insists on singing. It is a series of very small, very sincere squeaks.`,
];

export function buildMemberBirthdayPayload(people, { name, year, random = Math.random }) {
  const lines = people.map(({ member, row }) => {
    const age = ageOn(row, year);
    return `🎂 **${member.displayName}**${age ? ` turns **${age}**` : ''} today!`;
  });
  const embed = successEmbed({
    title: people.length > 1 ? '🎉 Happy Birthday, everyone!' : `🎉 Happy Birthday, ${people[0].member.displayName}!`,
    description: [
      ...lines,
      '',
      BIRTHDAY_LINES[Math.floor(random() * BIRTHDAY_LINES.length)](name),
      `She's slipped **${BIRTHDAY_GIFT} 🧀** into ${people.length > 1 ? 'each of your wallets' : 'your wallet'}.`,
    ].join('\n'),
  });
  embed.setColor(0xff8fc7);

  const buttons = people.slice(0, 25).map(({ member }) =>
    new ButtonBuilder()
      .setCustomId(`social:wish:${year}:${member.id}`)
      .setEmoji('🎉')
      .setLabel(componentText(`Wish ${member.displayName} happy birthday`, 'Send wishes', 80))
      .setStyle(ButtonStyle.Success),
  );
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));

  const payload = {
    content: people.map(({ member }) => `<@${member.id}>`).join(' '),
    embeds: [embed],
    components: rows,
    allowedMentions: { users: people.map(({ member }) => member.id) },
  };
  if (existsSync(BIRTHDAY_ART)) {
    payload.files = [new AttachmentBuilder(BIRTHDAY_ART, { name: 'birthday.gif' })];
    embed.setImage('attachment://birthday.gif');
  }
  return payload;
}

async function celebrateGuild(client, guild, now) {
  const today = wallClock(now, zoneOf(guild.id));
  const due = listBirthdays(guild.id).filter((row) => isBirthdayOn(row, today) && row.lastCelebratedYear !== today.year);
  if (due.length === 0) return 0;

  const channel = await socialChannel(client, guild.id);
  if (!channel) return 0; // not marked: if someone sets the channel later today, it still gets posted

  const people = [];
  for (const row of due) {
    markCelebrated(guild.id, row.userId, today.year);
    const member = await guild.members.fetch(row.userId).catch(() => null);
    if (member) people.push({ member, row });
  }
  if (people.length === 0) return 0;

  const roleId = getGuildConfig(guild.id)?.birthdayRoleId;
  const role = roleId ? guild.roles.cache.get(roleId) : null;
  for (const { member } of people) {
    giftCheese(guild.id, member.id, BIRTHDAY_GIFT);
    if (role?.editable) {
      const ok = await member.roles.add(role, 'Birthday!').then(() => true).catch(() => false);
      if (ok) markCelebrated(guild.id, member.id, today.year, { roleGranted: true });
    }
  }

  await channel.send(buildMemberBirthdayPayload(people, { name: peachesName(guild.id), year: today.year }));
  return people.length;
}

async function takeBackBirthdayRoles(client, now) {
  for (const row of listExpiredRoles(BIRTHDAY_ROLE_MS, now)) {
    clearRoleGrant(row.guildId, row.userId);
    const guild = client.guilds.cache.get(row.guildId);
    const roleId = getGuildConfig(row.guildId)?.birthdayRoleId;
    if (!guild || !roleId) continue;
    const member = await guild.members.fetch(row.userId).catch(() => null);
    await member?.roles.remove(roleId, 'Birthday is over').catch(() => {});
  }
}

export async function birthdayTick(client, now = new Date()) {
  for (const guild of client.guilds.cache.values()) {
    await celebrateGuild(client, guild, now).catch((err) => logger.warn({ err, guildId: guild.id }, 'Member birthday check failed'));
  }
  await takeBackBirthdayRoles(client, now.getTime()).catch((err) => logger.warn({ err }, 'Birthday role cleanup failed'));
}

export function buildReminderPayload(reminder, { name, now = Date.now() }) {
  const late = now - reminder.dueAt > LATE_NOTE_MS ? `\n-# Sorry this is late — ${name} was napping (I was offline). It was due <t:${Math.floor(reminder.dueAt / 1000)}:R>.` : '';
  return {
    content: `<@${reminder.userId}>`,
    embeds: [
      infoEmbed({
        title: '⏰ Reminder',
        description: `🐀 ${name} tugs on your sleeve:\n> ${reminder.text}\n\n-# You asked <t:${Math.floor(reminder.createdAt / 1000)}:R>.${late}`,
      }),
    ],
    // Ping the person who asked — and nobody else, whatever the text says.
    allowedMentions: { users: [reminder.userId] },
  };
}

export async function deliverDueReminders(client, now = Date.now()) {
  for (const reminder of dueReminders(now)) {
    if (!client.guilds.cache.has(reminder.guildId)) continue;
    if (!claimReminder(reminder.id)) continue;
    const channel = (await client.channels.fetch(reminder.channelId).catch(() => null)) ?? (await socialChannel(client, reminder.guildId));
    if (!channel) continue;
    await channel.send(buildReminderPayload(reminder, { name: peachesName(reminder.guildId), now })).catch((err) => logger.warn({ err, reminderId: reminder.id }, 'Could not deliver reminder'));
  }
}
