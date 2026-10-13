-- Every track that starts playing, for /musicstats, autoplay and the quiz.
CREATE TABLE IF NOT EXISTS music_plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  uri TEXT,
  source TEXT,
  requester_id TEXT, -- NULL for autoplay / Peaches picks
  duration INTEGER,
  is_stream INTEGER NOT NULL DEFAULT 0,
  played_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_music_plays_guild_time ON music_plays (guild_id, played_at);

-- Keep the music going with related songs when the queue runs out.
ALTER TABLE guilds ADD COLUMN autoplay INTEGER DEFAULT 0;
