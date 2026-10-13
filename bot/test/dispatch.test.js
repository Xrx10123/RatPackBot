import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { wireInteractionDispatch } from '../src/core/moduleLoader.js';

function registryWith(command) {
  return {
    commandExecutors: new Map([[command.name, command]]),
    buttonHandlers: new Map(),
    selectHandlers: new Map(),
    modalHandlers: new Map(),
  };
}

function baseInteraction(overrides) {
  return {
    commandName: 'news',
    guildId: null,
    isChatInputCommand: () => false,
    isAutocomplete: () => false,
    isButton: () => false,
    isAnySelectMenu: () => false,
    isModalSubmit: () => false,
    ...overrides,
  };
}

/** Emits the interaction and waits for the async listener to settle, surfacing anything it leaks. */
async function dispatch(client, interaction) {
  const leaked = [];
  const onRejection = (err) => leaked.push(err);
  process.on('unhandledRejection', onRejection);
  client.emit('interactionCreate', interaction);
  await new Promise((resolve) => setTimeout(resolve, 20));
  process.off('unhandledRejection', onRejection);
  return leaked;
}

test('a failing autocomplete does not leak an unhandled rejection (regression: crashed the bot)', async () => {
  const client = new EventEmitter();
  wireInteractionDispatch(client, registryWith({ name: 'news', autocomplete: async () => { throw new Error('Unknown interaction'); } }));

  const responded = [];
  // Real AutocompleteInteractions have respond() but no reply()/followUp().
  const interaction = baseInteraction({ isAutocomplete: () => true, respond: async (choices) => responded.push(choices) });
  const leaked = await dispatch(client, interaction);

  assert.deepEqual(leaked, []);
  assert.deepEqual(responded, [[]]);
});

test('a failing command gets an ephemeral apology', async () => {
  const client = new EventEmitter();
  wireInteractionDispatch(client, registryWith({ name: 'news', execute: async () => { throw new Error('boom'); } }));

  const replies = [];
  const interaction = baseInteraction({ isChatInputCommand: () => true, deferred: false, replied: false, reply: async (p) => replies.push(p) });
  assert.deepEqual(await dispatch(client, interaction), []);
  assert.equal(replies[0].ephemeral, true);
});
