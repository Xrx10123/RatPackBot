import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWhen, zonedTimeToUtc } from '../src/modules/social/timeParse.js';
import { isValidBirthday, isBirthdayOn, daysUntilBirthday, setBirthday, getBirthday, removeBirthday, addWish, countWishes } from '../src/modules/social/birthdays.js';
import { birthdayTick, deliverDueReminders, buildReminderPayload, buildMemberBirthdayPayload, BIRTHDAY_GIFT, BIRTHDAY_ROLE_MS } from '../src/modules/social/delivery.js';
import { createReminder, listUserReminders, cancelReminder, claimReminder } from '../src/modules/social/reminders.js';
import { remind } from '../src/modules/social/commands/remind.js';
import { birthday, birthdayButtons, WISH_GIFT } from '../src/modules/social/commands/birthday.js';
import { createRatpackCategory } from '../src/modules/setup/ui/channelStep.js';
import { updateGuildConfig, CHANNEL_PURPOSES } from '../src/core/guildConfig.js';
import { getWallet } from '../src/modules/peaches/economy.js';

const at = (iso) => new Date(iso);

test('parseWhen: relative times', () => {
  const now = at('2026-10-13T15:00:00Z');
  assert.equal(parseWhen('in 2h', now).date.toISOString(), '2026-10-13T17:00:00.000Z');
  assert.equal(parseWhen('2h30m', now).date.toISOString(), '2026-10-13T17:30:00.000Z');
  assert.equal(parseWhen('1 day and 3 hours', now).date.toISOString(), '2026-10-14T18:00:00.000Z');
  assert.match(parseWhen('in 30 seconds', now).error, /less than a minute/);
  assert.match(parseWhen('in 2 years', now).error, /year ahead/);
  assert.match(parseWhen('in 5 parsecs', now).error, /unit/);
  assert.match(parseWhen('', now).error, /when/);
});

test('parseWhen: clock times are read in the server timezone', () => {
  const now = at('2026-10-13T15:00:00Z'); // 11:00 in New York (EDT, UTC-4)
  const ny = 'America/New_York';
  assert.equal(parseWhen('at 9pm', now, ny).date.toISOString(), '2026-10-14T01:00:00.000Z');
  assert.equal(parseWhen('at 9am', now, ny).date.toISOString(), '2026-10-14T13:00:00.000Z', 'already past → tomorrow');
  assert.equal(parseWhen('tomorrow 8:30am', now, ny).date.toISOString(), '2026-10-14T12:30:00.000Z');
  assert.equal(parseWhen('tomorrow', now, ny).date.toISOString(), '2026-10-14T13:00:00.000Z');
  assert.equal(parseWhen('noon', now, ny).date.toISOString(), '2026-10-13T16:00:00.000Z');
  assert.equal(parseWhen('at 21:30', now, 'UTC').date.toISOString(), '2026-10-13T21:30:00.000Z');
  assert.match(parseWhen('at 13pm', now, ny).error, /real time/);
  assert.match(parseWhen('soonish', now, ny).error, /couldn't read/);
});

test('zonedTimeToUtc handles daylight-saving changes', () => {
  // New York: EST (-5) in January, EDT (-4) in July
  assert.equal(zonedTimeToUtc({ year: 2026, month: 1, day: 15, hour: 9, minute: 0 }, 'America/New_York').toISOString(), '2026-01-15T14:00:00.000Z');
  assert.equal(zonedTimeToUtc({ year: 2026, month: 7, day: 15, hour: 9, minute: 0 }, 'America/New_York').toISOString(), '2026-07-15T13:00:00.000Z');
  // The day after US clocks go back (Nov 1 2026)
  assert.equal(parseWhen('tomorrow 9am', at('2026-10-31T16:00:00Z'), 'America/New_York').date.toISOString(), '2026-11-01T14:00:00.000Z');
});

test('birthday validation and Feb 29', () => {
  assert.equal(isValidBirthday(2, 29), true);
  assert.equal(isValidBirthday(2, 29, 2001), false);
  assert.equal(isValidBirthday(2, 30), false);
  assert.equal(isValidBirthday(4, 31), false);
  assert.equal(isValidBirthday(13, 1), false);
  const leapling = { month: 2, day: 29 };
  assert.equal(isBirthdayOn(leapling, { year: 2026, month: 2, day: 28 }), true);
  assert.equal(isBirthdayOn(leapling, { year: 2028, month: 2, day: 28 }), false);
  assert.equal(isBirthdayOn(leapling, { year: 2028, month: 2, day: 29 }), true);
  assert.equal(daysUntilBirthday({ month: 10, day: 20 }, { year: 2026, month: 10, day: 13 }), 7);
  assert.equal(daysUntilBirthday({ month: 10, day: 1 }, { year: 2026, month: 10, day: 13 }), 353);
});

function fakeGuild(id, members, { roleEditable = true } = {}) {
  const roleLog = [];
  const membersById = new Map(
    members.map((userId) => [
      userId,
      {
        id: userId,
        displayName: `name-${userId}`,
        roles: { add: async (r) => roleLog.push(['add', userId, r.id ?? r]), remove: async (r) => roleLog.push(['remove', userId, r.id ?? r]) },
      },
    ]),
  );
  return {
    roleLog,
    guild: {
      id,
      roles: { cache: new Map([['bday-role', { id: 'bday-role', editable: roleEditable }]]) },
      members: { fetch: async (userId) => membersById.get(userId) ?? Promise.reject(new Error('Unknown member')) },
    },
  };
}

function fakeClient(guilds) {
  const sent = [];
  return {
    sent,
    guilds: { cache: new Map(guilds.map((g) => [g.id, g])) },
    channels: { fetch: async (id) => ({ id, isTextBased: () => true, send: async (p) => sent.push([id, p]) }) },
  };
}

test('member birthday: one post per year, cheese gift, role for a day', async () => {
  updateGuildConfig('g-mb', { timezone: 'UTC', socialChannelId: 'party-chan', birthdayRoleId: 'bday-role' });
  setBirthday('g-mb', 'alice', { month: 10, day: 20, year: 2000 });
  setBirthday('g-mb', 'bob', { month: 10, day: 20 });
  setBirthday('g-mb', 'gone', { month: 10, day: 20 }); // left the server
  setBirthday('g-mb', 'carol', { month: 3, day: 1 });
  const { guild, roleLog } = fakeGuild('g-mb', ['alice', 'bob', 'carol']);
  const client = fakeClient([guild]);

  await birthdayTick(client, at('2026-10-19T23:30:00Z'));
  assert.equal(client.sent.length, 0, 'not yet');
  await birthdayTick(client, at('2026-10-20T00:05:00Z'));
  await birthdayTick(client, at('2026-10-20T01:05:00Z'));
  assert.equal(client.sent.length, 1, 'one combined post');
  const [channelId, payload] = client.sent[0];
  assert.equal(channelId, 'party-chan');
  assert.match(payload.embeds[0].data.description, /name-alice\*\* turns \*\*26\*\*/);
  assert.deepEqual(payload.allowedMentions.users.sort(), ['alice', 'bob']);
  assert.equal(payload.components[0].toJSON().components.length, 2);
  assert.equal(getWallet('g-mb', 'alice').cheese, BIRTHDAY_GIFT);
  assert.deepEqual(roleLog.filter(([op]) => op === 'add').map(([, u]) => u).sort(), ['alice', 'bob']);

  await birthdayTick(client, new Date(Date.now() + BIRTHDAY_ROLE_MS + 60_000));
  assert.deepEqual(roleLog.filter(([op]) => op === 'remove').map(([, u]) => u).sort(), ['alice', 'bob'], 'role taken back after a day');
});

test('member birthday waits for a channel instead of losing the day', async () => {
  updateGuildConfig('g-mb2', { timezone: 'UTC', socialChannelId: null });
  setBirthday('g-mb2', 'dee', { month: 5, day: 5 });
  const { guild } = fakeGuild('g-mb2', ['dee']);
  const client = fakeClient([guild]);
  await birthdayTick(client, at('2026-05-05T08:00:00Z'));
  assert.equal(client.sent.length, 0);
  updateGuildConfig('g-mb2', { socialChannelId: 'late-chan' });
  await birthdayTick(client, at('2026-05-05T15:00:00Z'));
  assert.equal(client.sent.length, 1);
});

test('birthday payload with many people stays within Discord limits', () => {
  const people = Array.from({ length: 12 }, (_, i) => ({ member: { id: `u${i}`, displayName: 'x'.repeat(120) }, row: { month: 1, day: 1 } }));
  const payload = buildMemberBirthdayPayload(people, { name: 'Peaches', year: 2026 });
  for (const row of payload.components) row.toJSON();
  payload.embeds[0].toJSON();
  assert.ok(payload.components.length <= 5);
});

test('wishes: once per person per year, not to yourself, small cheese thank-you', async () => {
  const calls = [];
  const press = (userId) => ({
    guildId: 'g-wish',
    user: { id: userId },
    message: { embeds: [{ data: { title: 'Happy Birthday', description: 'x' } }] },
    update: async (p) => calls.push(['update', p]),
    followUp: async (p) => calls.push(['followUp', p]),
    reply: async (p) => calls.push(['reply', p]),
  });
  await birthdayButtons.wish(press('star'), '2026', 'star');
  assert.equal(calls.at(-1)[1].ephemeral, true);
  await birthdayButtons.wish(press('pal'), '2026', 'star');
  await birthdayButtons.wish(press('pal'), '2026', 'star');
  await birthdayButtons.wish(press('pal2'), '2026', 'star');
  assert.equal(countWishes('g-wish', 'star', 2026), 2);
  assert.equal(addWish('g-wish', 'star', 2027, 'pal'), true, 'next year is a new year');
  assert.equal(getWallet('g-wish', 'pal').cheese, WISH_GIFT);
  assert.match(calls.find(([k]) => k === 'update')[1].embeds[0].data.footer.text, /wish/);
});

test('reminders: delivered once, pings only the owner, late note after downtime', async () => {
  const r = createReminder({ guildId: 'g-rem', channelId: 'here', userId: 'me', text: '@everyone take the laundry out', dueAt: Date.now() - 10 * 60 * 1000 });
  createReminder({ guildId: 'g-rem', channelId: 'here', userId: 'me', text: 'future', dueAt: Date.now() + 3_600_000 });
  createReminder({ guildId: 'g-gone', channelId: 'x', userId: 'me', text: 'bot left this server', dueAt: Date.now() - 1000 });
  const client = fakeClient([{ id: 'g-rem' }]);

  await deliverDueReminders(client);
  await deliverDueReminders(client);
  assert.equal(client.sent.length, 1);
  const payload = client.sent[0][1];
  assert.deepEqual(payload.allowedMentions, { users: ['me'] });
  assert.match(payload.embeds[0].data.description, /laundry/);
  assert.match(payload.embeds[0].data.description, /late/);
  assert.equal(claimReminder(r.id), false);

  const onTime = buildReminderPayload({ ...r, dueAt: Date.now() }, { name: 'Peaches' });
  assert.doesNotMatch(onTime.embeds[0].data.description, /late/);
});

test('only the owner can cancel a reminder', () => {
  const r = createReminder({ guildId: 'g-can', channelId: 'c', userId: 'owner', text: 't', dueAt: Date.now() + 999_999 });
  assert.equal(cancelReminder(r.id, 'someone-else'), false);
  assert.equal(cancelReminder(r.id, 'owner'), true);
  assert.equal(listUserReminders('g-can', 'owner').length, 0);
});

function commandInteraction({ sub, options = {}, userId = 'u1', guildId = 'g-cmd', manager = false }) {
  const replies = [];
  return {
    replies,
    guildId,
    channelId: 'chan',
    user: { id: userId, toString: () => `<@${userId}>` },
    member: { permissions: { has: () => manager } },
    client: {},
    options: {
      getSubcommand: () => sub,
      getString: (k) => options[k] ?? null,
      getInteger: (k) => options[k] ?? null,
      getUser: (k) => options[k] ?? null,
      getRole: (k) => options[k] ?? null,
    },
    reply: async (p) => replies.push(p),
  };
}

test('/remind me + /birthday set happy paths and validation', async () => {
  updateGuildConfig('g-cmd', { timezone: 'UTC' });
  const ok = commandInteraction({ sub: 'me', options: { when: 'in 2h', what: 'stretch' } });
  await remind.execute(ok);
  assert.match(ok.replies[0].embeds[0].data.description, /stretch/);
  assert.equal(listUserReminders('g-cmd', 'u1').length, 1);

  const bad = commandInteraction({ sub: 'me', options: { when: 'whenever', what: 'x' } });
  await remind.execute(bad);
  assert.equal(bad.replies[0].ephemeral, true);

  const set = commandInteraction({ sub: 'set', options: { month: 2, day: 30 } });
  await birthday.execute(set);
  assert.match(set.replies[0].embeds[0].data.description, /isn't a real date/);

  const forOther = commandInteraction({ sub: 'set', options: { month: 1, day: 2, user: { id: 'friend', bot: false } } });
  await birthday.execute(forOther);
  assert.match(forOther.replies[0].embeds[0].data.description, /managers/);
  assert.equal(getBirthday('g-cmd', 'friend'), null);

  const asManager = commandInteraction({ sub: 'set', manager: true, options: { month: 1, day: 2, user: { id: 'friend', bot: false, toString: () => '<@friend>' } } });
  await birthday.execute(asManager);
  assert.equal(getBirthday('g-cmd', 'friend').day, 2);
  assert.equal(removeBirthday('g-cmd', 'friend'), true);
});

test('/setup Create Category only builds missing channels and reuses the category', async () => {
  const created = [];
  const existing = new Map([
    ['cat', { id: 'cat', type: 4, name: '🐀 Ratpack' }],
    ['news-chan', { id: 'news-chan', type: 0 }],
  ]);
  const guild = {
    channels: {
      cache: Object.assign(existing, { find: (fn) => [...existing.values()].find(fn) }),
      create: async (opts) => {
        created.push(opts.name);
        return { id: `new-${opts.name}` };
      },
    },
  };
  const fields = await createRatpackCategory(guild, { newsChannelId: 'news-chan', logChannelId: 'deleted-chan' });
  assert.ok(!created.includes('🐀 Ratpack'), 'category reused');
  assert.ok(!created.includes(CHANNEL_PURPOSES.news.defaultName), 'working channel kept');
  assert.ok(created.includes(CHANNEL_PURPOSES.log.defaultName), 'deleted channel recreated');
  assert.ok(created.includes(CHANNEL_PURPOSES.social.defaultName), 'new purpose created');
  assert.equal(fields.newsChannelId, undefined);
});
