-- DJ role, vote-skip threshold, and 24/7 mode weren't part of the original
-- guilds schema, but M12 (vote-skip threshold, DJ role, 24/7 toggle) needs
-- somewhere to persist them.
ALTER TABLE guilds ADD COLUMN dj_role_id TEXT;
ALTER TABLE guilds ADD COLUMN vote_skip_threshold INTEGER DEFAULT 50;
ALTER TABLE guilds ADD COLUMN twenty_four_seven INTEGER DEFAULT 0;
