import { pickLine } from './variants.js';

/**
 * Peaches reading the room. Everything here is pure (no Discord, no DB) so
 * the trigger words and rate limits can be tested directly; handlers/chat.js
 * does the actual reacting.
 */

const CHEESE = /\b(cheese|cheesy|cheddar|brie|gouda|mozzarella|parmesan|camembert|feta|halloumi|gruy[eè]re)\b/i;
const RAT = /\b(rats?|ratty|rodents?)\b/i;
const GOODNIGHT = /\b(good ?night|gn|nighty? ?night|night night|going to (bed|sleep)|off to (bed|sleep)|heading to bed)\b/i;
const MORNING = /\b(good ?morning|gm|mornin'?g? (all|everyone|folks|y'?all|guys|chat))\b|^\s*mornin'?g?\b/i;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function detectTriggers(content, name = 'Peaches') {
  const text = String(content ?? '');
  const names = [...new Set([name, 'Peaches'].filter(Boolean))].map(escapeRegex).join('|');
  return {
    name: new RegExp(`\\b(${names})\\b`, 'i').test(text),
    cheese: CHEESE.test(text),
    rat: RAT.test(text),
    goodnight: GOODNIGHT.test(text),
    morning: MORNING.test(text),
  };
}

export const LIMITS = {
  channelReactMs: 2 * 60 * 1000, // at most one emoji reaction per channel every 2 minutes
  channelReplyMs: 45 * 1000, // and one reply per channel every 45 seconds
  userGreetingMs: 6 * 60 * 60 * 1000, // one goodnight/good-morning reply per person per 6 hours
  userMentionMs: 60 * 1000, // one answer per person per minute when they @ her
};

const REACT_CHANCE = { name: 0.6, cheese: 0.35, rat: 0.25 };
const REACT_EMOJI = { name: ['🐀', '💕', '👀'], cheese: ['🧀'], rat: ['🐀'] };

/** Remembers when things last happened, keyed by "kind:id". */
export class ChatLimiter {
  constructor() {
    this.last = new Map();
  }
  ready(key, windowMs, now) {
    return now - (this.last.get(key) ?? -Infinity) >= windowMs;
  }
  mark(key, now) {
    this.last.set(key, now);
    if (this.last.size > 5000) this.last.clear(); // small friend servers never get near this; just don't grow forever
  }
}

const GOODNIGHT_LINES = [
  (n, u) => `🌙 Goodnight ${u}. ${n} tucks a crumb under your pillow for later.`,
  (n, u) => `🌙 Night night, ${u}! ${n} will guard the cheese drawer while you sleep.`,
  (n, u) => `🌙 ${n} squeaks goodnight to ${u} and burrows into her nest.`,
];
const MORNING_LINES = [
  (n, u) => `☀️ Good morning, ${u}! ${n} has been up for hours. She's hungry.`,
  (n, u) => `☀️ Morning, ${u}! ${n} stretches, yawns, and immediately asks about breakfast.`,
  (n, u) => `☀️ ${n} scampers over to say good morning to ${u}. Her whiskers are a mess.`,
];
const SLEEPY_LINES = [
  (n, u) => `💤 ${n} mumbles something at ${u} from deep inside her nest and goes back to sleep.`,
  (n) => `💤 Shh. ${n} is asleep. A tiny snore escapes the nest.`,
];
const MENTION_LINES = {
  thriving: [(n) => `🐀 ${n} does a happy little hop.`, (n) => `🐀 ${n} squeaks delightedly and boops your hand.`],
  content: [(n) => `🐀 ${n} looks up at you, whiskers twitching.`, (n) => `🐀 ${n} squeaks politely.`],
  restless: [(n) => `🐀 ${n} glances at you, then at the cheese drawer, then back at you.`],
  grumpy: [(n) => `🐀 ${n} turns her back on you. Pointedly.`, (n) => `🐀 ${n} is not taking questions at this time.`],
  neglected: [(n) => `🐀 Oh, *now* you remember ${n}? She stares at you, wounded.`],
};

/**
 * Decides how Peaches responds to one message.
 *
 * @param {object} msg  { content, authorId, authorMention, channelId, mentionsHer }
 * @param {object} ctx  { name, mood, asleep, now, limiter, random }
 * @returns {{ react?: string, reply?: string, happiness?: number }}
 */
export function decideChatResponse(msg, { name, mood, asleep, now, limiter, random = Math.random }) {
  const t = detectTriggers(msg.content, name);
  const out = {};
  const replyKey = `reply:${msg.channelId}`;
  const canReply = limiter.ready(replyKey, LIMITS.channelReplyMs, now);

  const greeting = t.goodnight ? 'goodnight' : t.morning ? 'morning' : null;
  if (canReply && greeting && limiter.ready(`greet:${msg.authorId}`, LIMITS.userGreetingMs, now)) {
    const pool = asleep && greeting === 'morning' ? SLEEPY_LINES : greeting === 'goodnight' ? GOODNIGHT_LINES : MORNING_LINES;
    out.reply = pickLine(pool)(name, msg.authorMention);
    out.happiness = 2;
    limiter.mark(`greet:${msg.authorId}`, now);
    limiter.mark(replyKey, now);
    return out;
  }

  if (canReply && msg.mentionsHer && limiter.ready(`mention:${msg.authorId}`, LIMITS.userMentionMs, now)) {
    out.reply = asleep ? pickLine(SLEEPY_LINES)(name, msg.authorMention) : pickLine(MENTION_LINES[mood] ?? MENTION_LINES.content)(name);
    limiter.mark(`mention:${msg.authorId}`, now);
    limiter.mark(replyKey, now);
    return out;
  }

  if (asleep) return out; // no emoji reactions in the middle of the night
  const reactKey = `react:${msg.channelId}`;
  if (!limiter.ready(reactKey, LIMITS.channelReactMs, now)) return out;
  for (const trigger of ['name', 'cheese', 'rat']) {
    if (t[trigger] && random() < REACT_CHANCE[trigger]) {
      out.react = pickLine(REACT_EMOJI[trigger]);
      limiter.mark(reactKey, now);
      break;
    }
  }
  return out;
}

