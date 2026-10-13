-- Fifth /setup channel: where Peaches posts member birthdays and reminders.
ALTER TABLE guilds ADD COLUMN social_channel_id TEXT;
-- Optional role given to members on their birthday (for the day).
ALTER TABLE guilds ADD COLUMN birthday_role_id TEXT;

CREATE TABLE IF NOT EXISTS member_birthdays (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  year INTEGER, -- optional; only used to show an age
  last_celebrated_year INTEGER,
  role_granted_at INTEGER,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS birthday_wishes (
  guild_id TEXT NOT NULL,
  birthday_user_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  wisher_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, birthday_user_id, year, wisher_id)
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders (delivered, due_at);
