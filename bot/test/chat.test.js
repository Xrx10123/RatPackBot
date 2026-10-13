import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectTriggers, decideChatResponse, ChatLimiter, LIMITS } from '../src/modules/peaches/chat.js';
import { handleChatMessage, isChatMuted } from '../src/modules/peaches/handlers/chat.js';
import { hasMessageContentFlag, shouldRequestMessageContent } from '../src/core/intents.js';
import { ensurePeachesConfig, updatePeachesConfig } from '../src/modules/peaches/config.js';
import { updateGuildConfig } from '../src/core/guildConfig.js';
import { renamePeaches } from '../src/modules/peaches/state.js';

test('trigger words', () => {
  assert.equal(detectTriggers('I love cheddar').cheese, true);
  assert.equal(detectTriggers('the Ratpack bot').rat, false, '"rat" inside another word is not a rat');
  assert.equal(detectTriggers('saw a rat today').rat, true);
  assert.equal(detectTriggers('hi peaches!').name, true);
  assert.equal(detectTriggers('hi Nibbles', 'Nibbles').name, true, 'follows a rename');
  assert.equal(detectTriggers('peachy keen').name, false);
  for (const gn of ['goodnight all', 'gn', 'Good night!', 'ok going to bed', 'night night']) assert.equal(detectTriggers(gn).goodnight, true, gn);
  for (const gm of ['good morning', 'gm', 'Morning!', 'morning all']) assert.equal(detectTriggers(gm).morning, true, gm);
  assert.equal(detectTriggers('see you tomorrow morning').morning, false);
  assert.equal(detectTriggers('(c) a.b* name', 'a.b*').name, false, 'regex characters in a name are escaped');
});

const ctx = (overrides = {}) => ({ name: 'Peaches', mood: 'content', asleep: false, now: 1_000_000, limiter: new ChatLimiter(), random: () => 0, ...overrides });
const msg = (content, extra = {}) => ({ content, authorId: 'u1', authorMention: '<@u1>', channelId: 'c1', mentionsHer: false, ...extra });

test('goodnight gets one reply per person per 6 hours', () => {
  const c = ctx();
  assert.match(decideChatResponse(msg('goodnight'), c).reply, /<@u1>/);
  const later = { ...c, now: c.now + LIMITS.channelReplyMs + 1 };
  assert.equal(decideChatResponse(msg('gn'), later).reply, undefined);
  assert.ok(decideChatResponse(msg('gn', { authorId: 'u2', authorMention: '<@u2>' }), later).reply, 'someone else still gets one');
  assert.ok(decideChatResponse(msg('gn'), { ...c, now: c.now + LIMITS.userGreetingMs + 1 }).reply);
});

test('replies are rate-limited per channel', () => {
  const c = ctx();
  assert.ok(decideChatResponse(msg('gm'), c).reply);
  assert.equal(decideChatResponse(msg('gm', { authorId: 'u2' }), c).reply, undefined, 'same channel, too soon');
  assert.ok(decideChatResponse(msg('gm', { authorId: 'u2', channelId: 'c2' }), c).reply, 'other channel is fine');
});

test('emoji reactions: at most one per channel per window, chance-based', () => {
  const c = ctx();
  assert.equal(decideChatResponse(msg('cheese time'), c).react, '🧀');
  assert.equal(decideChatResponse(msg('more cheese'), c).react, undefined);
  assert.equal(decideChatResponse(msg('more cheese'), { ...c, now: c.now + LIMITS.channelReactMs }).react, '🧀');
  assert.equal(decideChatResponse(msg('cheese'), ctx({ random: () => 0.99 })).react, undefined, 'not every time');
  assert.equal(decideChatResponse(msg('nothing to see here'), ctx()).react, undefined);
});

test('@mentions get a mood-flavoured answer; asleep she mumbles and never reacts', () => {
  assert.match(decideChatResponse(msg('hey', { mentionsHer: true }), ctx({ mood: 'grumpy' })).reply, /back on you|not taking/);
  assert.match(decideChatResponse(msg('hey', { mentionsHer: true }), ctx({ asleep: true })).reply, /💤/);
  assert.deepEqual(decideChatResponse(msg('cheese rats peaches'), ctx({ asleep: true })), {});
  assert.match(decideChatResponse(msg('goodnight'), ctx({ asleep: true })).reply, /🌙/, 'goodnight still works at night');
});

test('message content intent flags', () => {
  assert.equal(hasMessageContentFlag(0), false);
  assert.equal(hasMessageContentFlag(1 << 18), true);
  assert.equal(hasMessageContentFlag(1 << 19), true);
  assert.equal(hasMessageContentFlag((1 << 23) | (1 << 12)), false);
});

test('intent check honours the override and falls back to off', async () => {
  assert.equal(await shouldRequestMessageContent('t', { MESSAGE_CONTENT_INTENT: 'true' }), true);
  assert.equal(await shouldRequestMessageContent('t', { MESSAGE_CONTENT_INTENT: 'false' }), false);
});

function fakeMessage({ guildId, content, channelId = 'chan', authorId = 'friend', bot = false, mentionsBot = false }) {
  const calls = [];
  return {
    calls,
    guild: { id: guildId },
    channelId,
    content,
    system: false,
    author: { id: authorId, bot, toString: () => `<@${authorId}>` },
    mentions: { users: new Map(mentionsBot ? [['bot', {}]] : []), repliedUser: null },
    react: async (e) => calls.push(['react', e]),
    reply: async (p) => calls.push(['reply', p]),
  };
}
const client = { user: { id: 'bot' } };

test('handler: replies without pinging, ignores bots, respects mutes', async () => {
  updateGuildConfig('g-chat', { timezone: 'Pacific/Kiritimati' });
  updatePeachesConfig('g-chat', { quietHours: 0 });

  const gm = fakeMessage({ guildId: 'g-chat', content: 'good morning!' });
  await handleChatMessage(client, gm);
  assert.equal(gm.calls[0][0], 'reply');
  assert.deepEqual(gm.calls[0][1].allowedMentions, { parse: [], repliedUser: false });

  const botMsg = fakeMessage({ guildId: 'g-chat', content: 'goodnight', authorId: 'other-bot', bot: true });
  await handleChatMessage(client, botMsg);
  assert.equal(botMsg.calls.length, 0);

  updatePeachesConfig('g-chat', { chatMutedChannels: 'quiet-room' });
  const muted = fakeMessage({ guildId: 'g-chat', channelId: 'quiet-room', content: 'goodnight', authorId: 'someone-new' });
  await handleChatMessage(client, muted);
  assert.equal(muted.calls.length, 0);
  assert.equal(isChatMuted(ensurePeachesConfig('g-chat'), 'quiet-room'), true);

  updatePeachesConfig('g-chat', { chatReactions: 0 });
  const off = fakeMessage({ guildId: 'g-chat', channelId: 'elsewhere', content: 'hey', authorId: 'pal', mentionsBot: true });
  await handleChatMessage(client, off);
  assert.equal(off.calls.length, 0);
});

test('handler: an @mention works even with no message text (intent off)', async () => {
  updatePeachesConfig('g-chat2', { quietHours: 0 });
  renamePeaches('g-chat2', 'Nibbles');
  const ping = fakeMessage({ guildId: 'g-chat2', channelId: 'chan-2', content: '', mentionsBot: true });
  await handleChatMessage(client, ping);
  assert.equal(ping.calls[0][0], 'reply');
  assert.match(ping.calls[0][1].content, /Nibbles/);
});
