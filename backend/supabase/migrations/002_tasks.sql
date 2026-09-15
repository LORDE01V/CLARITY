-- CLARITY tasks table for Kanban-style team task tracking

CREATE TYPE task_status AS ENUM (
    'todo',
    'in_progress',
    'done'
);

CREATE TABLE tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id      UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    status       task_status NOT NULL DEFAULT 'todo',
    assignee_id  UUID,
    position     INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_team_id ON tasks(team_id);
CREATE INDEX idx_tasks_team_status ON tasks(team_id, status);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
