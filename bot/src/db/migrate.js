import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../core/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Minimal, dependency-free migration runner: applies db/migrations/*.sql
 * in filename order, tracking what's already run in a `_migrations` table.
 * Each file runs inside its own transaction.
 */
export function runMigrations(sqlite) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(sqlite.prepare('SELECT name FROM _migrations').all().map((row) => row.name));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const runMigration = sqlite.transaction(() => {
      sqlite.exec(sql);
      sqlite.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(file, Date.now());
    });

    runMigration();
    logger.info({ migration: file }, 'Applied database migration');
  }
}
