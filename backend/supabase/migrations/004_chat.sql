-- CLARITY team-scoped chat channels and messages

CREATE TABLE chat_channels (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id      UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT,
    is_default   BOOLEAN NOT NULL DEFAULT false,
    created_by   UUID NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, name)
);

CREATE INDEX idx_chat_channels_team_id ON chat_channels(team_id);
CREATE UNIQUE INDEX idx_chat_channels_team_default
    ON chat_channels(team_id)
    WHERE is_default = true;

CREATE TABLE chat_messages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id    UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    author_id     UUID NOT NULL,
    author_email  TEXT NOT NULL,
    author_name   TEXT,
    body          TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_channel_created
    ON chat_messages(channel_id, created_at DESC);

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
