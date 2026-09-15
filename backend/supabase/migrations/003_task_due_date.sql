-- Add optional due dates to team tasks

ALTER TABLE tasks
    ADD COLUMN due_date DATE;

CREATE INDEX idx_tasks_due_date ON tasks(due_date)
    WHERE due_date IS NOT NULL;
