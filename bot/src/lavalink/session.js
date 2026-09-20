import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { logger } from '../core/logger.js';

const SESSION_FILE = path.join(path.dirname(config.database.path), 'lavalink-session.json');

/**
 * Persists the Lavalink node's session id so a quick bot restart can resume
 * it (Lavalink keeps the voice connection + audio alive server-side for the
 * configured resume timeout even while the bot process is down).
 */
export function readSavedSessionId() {
  try {
    const raw = readFileSync(SESSION_FILE, 'utf8');
    return JSON.parse(raw).sessionId ?? null;
  } catch {
    return null;
  }
}

export function saveSessionId(sessionId) {
  try {
    mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
    writeFileSync(SESSION_FILE, JSON.stringify({ sessionId }));
  } catch (err) {
    logger.warn({ err }, 'Could not persist Lavalink session id');
  }
}
