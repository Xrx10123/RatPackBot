-- Peaches keeps to the server's timezone (set in /setup): no spawns or
-- mischief overnight unless a manager turns this off with /pet config.
ALTER TABLE peaches_config ADD COLUMN quiet_hours INTEGER DEFAULT 1;
