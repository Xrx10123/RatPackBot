import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerCommands } from './commandRegistry.js';
import { scheduleWithJitter } from './scheduler.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.join(__dirname, '..', 'modules');

// customId convention: `${moduleName}:${handlerKey}:${...extraArgs}`
// e.g. "music:pause" or "music:queue_jump:5"
const ID_SEPARATOR = ':';

/**
 * Discovers every modules/<name>/index.js, validates its module contract,
 * and wires commands, components, events, and cron jobs into the client.
 * A module can be disabled by removing/renaming its folder — the loader
 * never needs to know it existed.
 */
export async function loadModules(client, { disabled = [] } = {}) {
  const registry = {
    modules: [],
    commandExecutors: new Map(), // name -> { execute, autocomplete }
    buttonHandlers: new Map(), // "module:key" -> handler
    selectHandlers: new Map(),
    modalHandlers: new Map(),
  };

  const entries = readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !disabled.includes(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const modulePath = path.join(MODULES_DIR, entry.name, 'index.js');
    let mod;
    try {
      mod = (await import(pathToFileURL(modulePath).href)).default;
    } catch (err) {
      logger.error({ err, module: entry.name }, 'Failed to load module — skipping');
      continue;
    }

    if (!mod || typeof mod.name !== 'string') {
      logger.error({ module: entry.name }, 'Module has no default export with a `name` — skipping');
      continue;
    }

    registerModule(client, registry, mod);
    registry.modules.push(mod);
    logger.info({ module: mod.name }, 'Module loaded');
  }

  await registerCommands(registry.modules.flatMap((m) => m.commands ?? []).map((c) => c.data));

  wireInteractionDispatch(client, registry);

  return registry;
}

function registerModule(client, registry, mod) {
  for (const command of mod.commands ?? []) {
    if (registry.commandExecutors.has(command.data.name)) {
      logger.warn({ command: command.data.name, module: mod.name }, 'Duplicate command name — overwriting');
    }
    registry.commandExecutors.set(command.data.name, command);
  }

  for (const [key, handler] of Object.entries(mod.buttons ?? {})) {
    registry.buttonHandlers.set(`${mod.name}${ID_SEPARATOR}${key}`, handler);
  }
  for (const [key, handler] of Object.entries(mod.selects ?? {})) {
    registry.selectHandlers.set(`${mod.name}${ID_SEPARATOR}${key}`, handler);
  }
  for (const [key, handler] of Object.entries(mod.modals ?? {})) {
    registry.modalHandlers.set(`${mod.name}${ID_SEPARATOR}${key}`, handler);
  }

  for (const { name, execute } of mod.events ?? []) {
    client.on(name, (...args) => {
      Promise.resolve(execute(client, ...args)).catch((err) =>
        logger.error({ err, module: mod.name, event: name }, 'Event handler threw'),
      );
    });
  }

  for (const { schedule, task, name } of mod.cron ?? []) {
    scheduleWithJitter(schedule, () => task(client), { name: `${mod.name}:${name ?? 'cron'}` });
  }

  if (typeof mod.init === 'function') {
    client.once('ready', () => {
      Promise.resolve(mod.init(client)).catch((err) =>
        logger.error({ err, module: mod.name }, 'Module init() threw'),
      );
    });
  }
}

/** customId -> "module:key" lookup key (drops any trailing :args) */
function lookupKey(customId) {
  const [moduleName, key] = customId.split(ID_SEPARATOR);
  return `${moduleName}${ID_SEPARATOR}${key}`;
}

function extraArgs(customId) {
  return customId.split(ID_SEPARATOR).slice(2);
}

function wireInteractionDispatch(client, registry) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = registry.commandExecutors.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
        return;
      }

      if (interaction.isAutocomplete()) {
        const command = registry.commandExecutors.get(interaction.commandName);
        if (!command?.autocomplete) return;
        await command.autocomplete(interaction);
        return;
      }

      if (interaction.isButton()) {
        const handler = registry.buttonHandlers.get(lookupKey(interaction.customId));
        if (!handler) return;
        await handler(interaction, ...extraArgs(interaction.customId));
        return;
      }

      if (interaction.isAnySelectMenu()) {
        const handler = registry.selectHandlers.get(lookupKey(interaction.customId));
        if (!handler) return;
        await handler(interaction, ...extraArgs(interaction.customId));
        return;
      }

      if (interaction.isModalSubmit()) {
        const handler = registry.modalHandlers.get(lookupKey(interaction.customId));
        if (!handler) return;
        await handler(interaction, ...extraArgs(interaction.customId));
      }
    } catch (err) {
      logger.error({ err, customId: interaction.customId, command: interaction.commandName }, 'Interaction handler threw');
      const payload = { content: '🐀 Something broke on my end. Try again in a moment.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  });
}
