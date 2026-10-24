-- Backing store for the music panel's History button. There was previously
-- no persistent record of what played — player.queue.previous is in-memory
-- and lost on restart/disconnect.
CREATE TABLE play_history (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  title TEXT,
  artist TEXT,
  uri TEXT,
  duration INTEGER,
  source TEXT,
  requester_id TEXT,
  played_at INTEGER
);

CREATE INDEX idx_play_history_guild_played_at ON play_history (guild_id, played_at DESC);
