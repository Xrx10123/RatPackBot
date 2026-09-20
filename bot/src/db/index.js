import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { runMigrations } from './migrate.js';
import * as schema from './schema.js';

mkdirSync(path.dirname(config.database.path), { recursive: true });

const sqlite = new Database(config.database.path);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

runMigrations(sqlite);

export const db = drizzle(sqlite, { schema });
