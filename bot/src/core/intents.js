import { REST, Routes, ApplicationFlagsBitField } from 'discord.js';
import { logger } from './logger.js';

const CONTENT_FLAGS = ApplicationFlagsBitField.Flags.GatewayMessageContent | ApplicationFlagsBitField.Flags.GatewayMessageContentLimited;

/** Pure check on an application's flags bitfield. */
export function hasMessageContentFlag(flags) {
  return (Number(flags ?? 0) & CONTENT_FLAGS) !== 0;
}

/**
 * Whether to request the privileged Message Content intent. Requesting it
 * while the toggle is OFF in the Developer Portal makes Discord reject the
 * login outright (close code 4014) — the bot wouldn't start at all — so
 * instead of hard-coding it, ask Discord whether it's been switched on.
 *
 * MESSAGE_CONTENT_INTENT=true|false in .env overrides the check.
 */
export async function shouldRequestMessageContent(token, env = process.env) {
  if (env.MESSAGE_CONTENT_INTENT === 'true') return true;
  if (env.MESSAGE_CONTENT_INTENT === 'false') return false;
  try {
    const app = await new REST().setToken(token).get(Routes.currentApplication());
    const enabled = hasMessageContentFlag(app?.flags);
    logger.info(
      { messageContent: enabled },
      enabled
        ? 'Message Content intent is on — Peaches can react to chat'
        : 'Message Content intent is off in the Developer Portal — Peaches only answers @mentions and replies',
    );
    return enabled;
  } catch (err) {
    logger.warn({ err }, 'Could not check the Message Content intent — starting without it');
    return false;
  }
}
