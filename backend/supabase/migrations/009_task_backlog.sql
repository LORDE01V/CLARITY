-- Add Jira-style backlog column to task_status enum
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'backlog';
