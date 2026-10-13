-- Mini-games (hide-and-seek, trivia, rat race). Stored so a restart mid-game
-- is cleaned up by the sweep instead of leaving buttons that do nothing.
CREATE TABLE IF NOT EXISTS peaches_games (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  type TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  winner_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_peaches_games_active ON peaches_games (guild_id, type, resolved);
