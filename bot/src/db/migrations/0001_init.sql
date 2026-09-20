-- Setup & Config
CREATE TABLE IF NOT EXISTS guilds (
  id TEXT PRIMARY KEY,
  panel_channel_id TEXT,
  news_channel_id TEXT,
  outage_channel_id TEXT,
  log_channel_id TEXT,
  timezone TEXT DEFAULT 'UTC',
  default_mention TEXT,
  default_role_id TEXT,
  flavor_enabled INTEGER DEFAULT 1,
  created_at INTEGER
);

-- Music
CREATE TABLE IF NOT EXISTS hoards (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_public INTEGER DEFAULT 0,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS hoard_tracks (
  id TEXT PRIMARY KEY,
  hoard_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  title TEXT,
  artist TEXT,
  uri TEXT,
  duration INTEGER,
  source TEXT
);

CREATE TABLE IF NOT EXISTS voice_panels (
  guild_id TEXT,
  voice_channel_id TEXT PRIMARY KEY,
  message_id TEXT,
  updated_at INTEGER
);

-- Games & News
CREATE TABLE IF NOT EXISTS game_news_subscriptions (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  steam_appid TEXT,
  enabled INTEGER DEFAULT 1,
  tag_filter TEXT,
  last_checked_at INTEGER
);

-- Outages
CREATE TABLE IF NOT EXISTS outage_monitors (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  service_slug TEXT NOT NULL,
  service_name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  last_status TEXT,
  last_checked_at INTEGER,
  last_notified_at INTEGER
);

CREATE TABLE IF NOT EXISTS user_outage_prefs (
  user_id TEXT,
  guild_id TEXT,
  service_slug TEXT,
  notify_enabled INTEGER DEFAULT 1,
  PRIMARY KEY (user_id, guild_id, service_slug)
);

-- Peaches
CREATE TABLE IF NOT EXISTS peaches_state (
  guild_id TEXT PRIMARY KEY,
  name TEXT DEFAULT 'Peaches',
  hunger INTEGER DEFAULT 80,
  thirst INTEGER DEFAULT 80,
  happiness INTEGER DEFAULT 80,
  energy INTEGER DEFAULT 80,
  cleanliness INTEGER DEFAULT 80,
  mood TEXT DEFAULT 'content',
  level INTEGER DEFAULT 1,
  last_spawn_at INTEGER,
  last_decay_at INTEGER,
  renamed_at INTEGER
);

CREATE TABLE IF NOT EXISTS peaches_spawns (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  spawned_at INTEGER,
  expires_at INTEGER,
  variant TEXT,
  resolved INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS peaches_interactions (
  id TEXT PRIMARY KEY,
  spawn_id TEXT,
  user_id TEXT,
  action TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS peaches_mischief (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  type TEXT,
  spawned_at INTEGER,
  expires_at INTEGER,
  resolved INTEGER DEFAULT 0,
  resolved_by TEXT,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS peaches_stats (
  guild_id TEXT,
  user_id TEXT,
  cheese_fed INTEGER DEFAULT 0,
  turds_cleaned INTEGER DEFAULT 0,
  holes_investigated INTEGER DEFAULT 0,
  walls_knocked INTEGER DEFAULT 0,
  fealty_pledged INTEGER DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS peaches_config (
  guild_id TEXT PRIMARY KEY,
  mischief_enabled INTEGER DEFAULT 1,
  escalation_enabled INTEGER DEFAULT 1,
  mischief_frequency TEXT DEFAULT 'normal',
  cross_music INTEGER DEFAULT 1,
  cross_news INTEGER DEFAULT 1,
  cross_outages INTEGER DEFAULT 1,
  cross_hoards INTEGER DEFAULT 1,
  spawn_channels TEXT
);
