-- CLARITY video meetings (Jitsi room links; works with public meet.jit.si)

CREATE TABLE meetings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    room_name     TEXT NOT NULL,
    meeting_url   TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'live'
                  CHECK (status IN ('scheduled', 'live', 'ended')),
    created_by    UUID NOT NULL,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at      TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, room_name)
);

CREATE INDEX idx_meetings_team_started
    ON meetings (team_id, started_at DESC);

CREATE INDEX idx_meetings_team_status
    ON meetings (team_id, status);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Optional link from recap back to a meeting
ALTER TABLE meeting_recaps
    ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;
