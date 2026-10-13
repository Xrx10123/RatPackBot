// Loaded via `node --import ./test/env.js --test` before any test file, so
// config.js's required-env checks pass and every test process (node:test
// runs each file in its own process) gets a throwaway SQLite database.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DISCORD_TOKEN ??= 'test-token';
process.env.DISCORD_CLIENT_ID ??= '100000000000000000';
process.env.LAVALINK_PASSWORD ??= 'test';
process.env.LOG_LEVEL = 'silent';
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'ratpack-test-')), 'test.db');
