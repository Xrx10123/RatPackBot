import { logger } from '../../../core/logger.js';
import { ensureState, getCurrentState, nudgeStats } from '../state.js';
import { ensurePeachesConfig, isSleepingNow } from '../config.js';
import { ChatLimiter, decideChatResponse, detectTriggers } from '../chat.js';

const limiter = new ChatLimiter();

export function isChatMuted(config, channelId) {
  if (config.chatReactions === 0) return true;
  return (config.chatMutedChannels ?? '').split(',').includes(channelId);
}

/**
 * messageCreate → maybe an emoji reaction or a short reply from Peaches.
 * Without the Message Content intent, Discord only gives us the text of
 * messages that @mention her or reply to her, so those still work.
 */
export async function handleChatMessage(client, message) {
  try {
    if (!message.guild || message.author?.bot || message.system) return;

    const mentionsHer = message.mentions?.users?.has(client.user.id) || message.mentions?.repliedUser?.id === client.user.id;
    const { name } = ensureState(message.guild.id);
    const triggers = detectTriggers(message.content, name);
    if (!mentionsHer && !Object.values(triggers).some(Boolean)) return; // the common case: nothing for her here

    const config = ensurePeachesConfig(message.guild.id);
    if (isChatMuted(config, message.channelId)) return;

    const state = getCurrentState(message.guild.id);
    const response = decideChatResponse(
      { content: message.content, authorId: message.author.id, authorMention: `${message.author}`, channelId: message.channelId, mentionsHer },
      { name: state.name, mood: state.mood, asleep: isSleepingNow(message.guild.id), now: Date.now(), limiter },
    );

    if (response.react) await message.react(response.react).catch(() => {});
    if (response.reply) {
      // Show the @ but don't ping anyone — goodnight shouldn't buzz a phone.
      await message.reply({ content: response.reply, allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});
    }
    if (response.happiness) nudgeStats(message.guild.id, { happiness: response.happiness });
  } catch (err) {
    logger.warn({ err }, 'Peaches chat reaction failed');
  }
}
