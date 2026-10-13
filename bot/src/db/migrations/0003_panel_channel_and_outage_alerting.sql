-- The Rat Nest panel normally lives in the voice channel's own chat, but
-- falls back to the configured music channel when the bot can't post there.
-- NULL means "same as voice_channel_id" (every row written before this).
ALTER TABLE voice_panels ADD COLUMN message_channel_id TEXT;

-- Whether a "down" alert has been posted for the monitor's current incident
-- and not yet followed by a recovery. Alerts used to key off exact
-- up->down / down->up transitions, so an incident that passed through
-- 'degraded' (minor -> major, the common Statuspage pattern) never alerted.
ALTER TABLE outage_monitors ADD COLUMN alerting INTEGER DEFAULT 0;
-- Consecutive failed fetches of the status page itself — one network blip
-- shouldn't page the whole server.
ALTER TABLE outage_monitors ADD COLUMN fail_count INTEGER DEFAULT 0;
-- Anything already down when this ships was alerted under the old logic —
-- mark it as an open incident so it isn't announced a second time.
UPDATE outage_monitors SET alerting = 1 WHERE last_status = 'down';
