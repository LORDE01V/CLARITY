-- Story points (effort) + parent/child task links (Jira-style)

ALTER TABLE tasks
    ADD COLUMN story_points INTEGER
        CHECK (story_points IS NULL OR (story_points >= 1 AND story_points <= 100)),
    ADD COLUMN parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id)
    WHERE parent_task_id IS NOT NULL;

COMMENT ON COLUMN tasks.story_points IS 'Relative effort estimate (1–100), Jira-style story points';
COMMENT ON COLUMN tasks.parent_task_id IS 'Optional parent task on the same team (e.g. bug → story)';
