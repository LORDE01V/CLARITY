-- Time entries: task-linked hours + external (non-task) work.
-- Backend uses the service role key (bypasses RLS).

CREATE TABLE IF NOT EXISTS time_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
    work_date       DATE NOT NULL,
    minutes         INTEGER NOT NULL CHECK (minutes > 0 AND minutes <= 24 * 60),
    title           TEXT,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT time_entries_task_or_title CHECK (
        task_id IS NOT NULL
        OR (title IS NOT NULL AND length(trim(title)) > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_time_entries_team_date
    ON time_entries(team_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_team_user_date
    ON time_entries(team_id, user_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_task_id
    ON time_entries(task_id)
    WHERE task_id IS NOT NULL;

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
