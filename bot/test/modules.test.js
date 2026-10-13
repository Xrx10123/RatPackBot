import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODULES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'modules');

async function loadAll() {
  const mods = [];
  for (const name of readdirSync(MODULES_DIR)) {
    mods.push((await import(pathToFileURL(path.join(MODULES_DIR, name, 'index.js')).href)).default);
  }
  return mods;
}

test('every module loads and exports the module contract', async () => {
  for (const mod of await loadAll()) {
    assert.equal(typeof mod.name, 'string');
    for (const key of ['buttons', 'selects', 'modals']) {
      for (const [handlerKey, fn] of Object.entries(mod[key] ?? {})) {
        assert.equal(typeof fn, 'function', `${mod.name}.${key}.${handlerKey}`);
        assert.ok(!handlerKey.includes(':'), 'handler keys cannot contain the customId separator');
      }
    }
  }
});

test('every slash command passes Discord schema validation and names are unique', async () => {
  const names = new Set();
  for (const mod of await loadAll()) {
    for (const command of mod.commands ?? []) {
      const json = command.data.toJSON(); // throws on invalid shape/lengths
      assert.ok(!names.has(json.name), `duplicate command /${json.name}`);
      names.add(json.name);
      assert.equal(typeof command.execute, 'function');
      const usesAutocomplete = JSON.stringify(json).includes('"autocomplete":true');
      if (usesAutocomplete) assert.equal(typeof command.autocomplete, 'function', `/${json.name} needs autocomplete()`);
    }
  }
  // Discord caps an application at 100 global chat commands.
  assert.ok(names.size <= 100);
});

test('cron schedules are valid', async () => {
  const cron = (await import('node-cron')).default;
  for (const mod of await loadAll()) {
    for (const job of mod.cron ?? []) assert.ok(cron.validate(job.schedule), `${mod.name}:${job.name}`);
  }
});
