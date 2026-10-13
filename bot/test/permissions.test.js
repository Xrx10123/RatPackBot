import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupButtons, setupSelects, setupModals } from '../src/modules/setup/handlers.js';
import { requireManager, isManager } from '../src/core/permissions.js';
import { skipOrEnd } from '../src/modules/music/playerLifecycle.js';

function fakeInteraction({ manager }) {
  const calls = [];
  return {
    calls,
    guildId: 'g-perm',
    member: { permissions: { has: () => manager } },
    deferred: false,
    replied: false,
    reply: async (p) => calls.push(['reply', p]),
    update: async (p) => calls.push(['update', p]),
    followUp: async (p) => calls.push(['followUp', p]),
  };
}

test('isManager / requireManager', async () => {
  assert.equal(isManager(null), false);
  const denied = fakeInteraction({ manager: false });
  assert.equal(await requireManager(denied), false);
  assert.equal(denied.calls[0][0], 'reply');
  assert.equal(denied.calls[0][1].ephemeral, true);
  assert.equal(await requireManager(fakeInteraction({ manager: true })), true);
});

test('every setup component handler refuses non-managers (regression)', async () => {
  // The welcome message's "Set Me Up" button is public, so these used to let anyone reconfigure the server.
  for (const handlers of [setupButtons, setupSelects, setupModals]) {
    for (const [key, handler] of Object.entries(handlers)) {
      const interaction = fakeInteraction({ manager: false });
      await handler(interaction, 'news');
      assert.equal(interaction.calls.length, 1, key);
      assert.match(interaction.calls[0][1].embeds[0].data.description, /server managers/, key);
    }
  }
});

test('skipOrEnd never asks lavalink-client to skip past an empty queue', async () => {
  const calls = [];
  const player = (queued) => ({ queue: { tracks: Array(queued).fill({}) }, skip: async (...args) => calls.push(args) });
  await skipOrEnd(player(2));
  await skipOrEnd(player(0));
  assert.deepEqual(calls, [[], [0, false]]);
});
