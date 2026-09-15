-- CLARITY chat: direct messages and group conversations
-- Additive on top of 004_chat.sql (do not rewrite 004).

-- Conversation kind: team broadcast channel | 1:1 DM | multi-member group
ALTER TABLE chat_channels
    ADD COLUMN IF NOT EXISTS channel_type TEXT NOT NULL DEFAULT 'channel';

ALTER TABLE chat_channels
    DROP CONSTRAINT IF EXISTS chat_channels_channel_type_check;

ALTER TABLE chat_channels
    ADD CONSTRAINT chat_channels_channel_type_check
    CHECK (channel_type IN ('channel', 'dm', 'group'));

-- Sorted "uuidA:uuidB" key so each pair has at most one DM per team
ALTER TABLE chat_channels
    ADD COLUMN IF NOT EXISTS dm_pair_key TEXT;

-- Team channel names stay unique; DM/group names are not constrained the same way
ALTER TABLE chat_channels
    DROP CONSTRAINT IF EXISTS chat_channels_team_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_channels_team_name_broadcast
    ON chat_channels (team_id, name)
    WHERE channel_type = 'channel';

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_channels_team_dm_pair
    ON chat_channels (team_id, dm_pair_key)
    WHERE channel_type = 'dm' AND dm_pair_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_channels_team_type
    ON chat_channels (team_id, channel_type);

-- Explicit membership for dm/group; team channels remain implicit (all team members)
CREATE TABLE IF NOT EXISTS chat_channel_members (
    channel_id   UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL,
    email        TEXT NOT NULL,
    full_name    TEXT,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user_id
    ON chat_channel_members (user_id);

ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
