import { REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { logger } from './logger.js';

/**
 * Registers slash commands with Discord. Global registration is the default
 * (per the build plan); if DISCORD_GUILD_ID_DEV is set, commands are also
 * pushed to that guild instantly for fast local iteration (global propagation
 * can take up to an hour).
 *
 * @param {Array<import('discord.js').SlashCommandBuilder>} commands
 */
export async function registerCommands(commands) {
  const rest = new REST().setToken(config.discord.token);
  const body = commands.map((command) => command.toJSON());

  if (config.discord.devGuildId) {
    await rest.put(Routes.applicationGuildCommands(config.discord.clientId, config.discord.devGuildId), { body });
    logger.info({ count: body.length, guildId: config.discord.devGuildId }, 'Registered guild (dev) slash commands');
    return;
  }

  await rest.put(Routes.applicationCommands(config.discord.clientId), { body });
  logger.info({ count: body.length }, 'Registered global slash commands');
}
