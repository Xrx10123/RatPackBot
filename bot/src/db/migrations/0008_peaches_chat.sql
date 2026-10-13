-- Peaches reacting to chat: on by default; managers can turn it off for the
-- whole server or mute it in specific channels with /pet chat.
ALTER TABLE peaches_config ADD COLUMN chat_reactions INTEGER DEFAULT 1;
ALTER TABLE peaches_config ADD COLUMN chat_muted_channels TEXT;
