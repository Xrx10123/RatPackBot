-- The group's saved game list for /games pick and /games vote.
CREATE TABLE IF NOT EXISTS gamenight_games (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  min_players INTEGER,
  max_players INTEGER,
  added_by TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  last_played_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gamenight_games_name ON gamenight_games (guild_id, name COLLATE NOCASE);

-- /games vote polls (stored so a restart doesn't lose the votes).
CREATE TABLE IF NOT EXISTS gamenight_polls (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  created_by TEXT NOT NULL,
  options TEXT NOT NULL,      -- JSON: [gameId, ...]
  votes TEXT NOT NULL DEFAULT '{}', -- JSON: { userId: optionIndex }
  ends_at INTEGER NOT NULL,
  closed INTEGER NOT NULL DEFAULT 0
);
