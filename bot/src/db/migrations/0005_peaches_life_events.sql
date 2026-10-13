-- Peaches' birthday is per server: the day she (the bot) first joined it.
-- Stored once as 'MM-DD' + year so a later kick/re-invite doesn't move it.
ALTER TABLE peaches_state ADD COLUMN birthday TEXT;
ALTER TABLE peaches_state ADD COLUMN birth_year INTEGER;
ALTER TABLE peaches_state ADD COLUMN last_birthday_year INTEGER;

-- Things Peaches "finds" and hands to people. One row per find, so
-- duplicates are allowed and counted.
CREATE TABLE IF NOT EXISTS peaches_collectibles (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  found_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_peaches_collectibles_owner ON peaches_collectibles (guild_id, user_id);
