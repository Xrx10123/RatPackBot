-- Steam link + sale tracking for the game night list.
ALTER TABLE gamenight_games ADD COLUMN steam_appid TEXT;
ALTER TABLE gamenight_games ADD COLUMN deal_percent INTEGER;      -- discount we last announced (NULL/0 = not on sale)
ALTER TABLE gamenight_games ADD COLUMN deal_alerted_at INTEGER;

-- Per-server switches (both on by default; they post in the Game News channel).
ALTER TABLE guilds ADD COLUMN deal_alerts INTEGER DEFAULT 1;
ALTER TABLE guilds ADD COLUMN free_game_alerts INTEGER DEFAULT 1;

-- Free games already announced in each server, so each is posted once.
CREATE TABLE IF NOT EXISTS free_game_posts (
  guild_id TEXT NOT NULL,
  game_key TEXT NOT NULL,
  posted_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, game_key)
);
