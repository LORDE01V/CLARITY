-- CLARITY meeting recaps (AI draft → human review → send to chat)
-- Additive; run after 001–005. Works the same locally and on deployed Supabase.

CREATE TABLE meeting_recaps (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id          UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title            TEXT NOT NULL,
    meeting_url      TEXT,
    transcript       TEXT NOT NULL,
    summary          TEXT NOT NULL DEFAULT '',
    action_items     JSONB NOT NULL DEFAULT '[]'::jsonb,
    status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'reviewed', 'sent')),
    model            TEXT,
    created_by       UUID NOT NULL,
    reviewed_by      UUID,
    sent_channel_id  UUID,
    sent_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_recaps_team_created
    ON meeting_recaps (team_id, created_at DESC);

CREATE INDEX idx_meeting_recaps_team_status
    ON meeting_recaps (team_id, status);

ALTER TABLE meeting_recaps ENABLE ROW LEVEL SECURITY;
