-- Persist GitHub App installations + webhook activity (Render-safe)

CREATE TABLE IF NOT EXISTS github_installations (
    installation_id      TEXT PRIMARY KEY,
    account_login        TEXT,
    account_type         TEXT,
    repository_selection TEXT,
    repositories         JSONB NOT NULL DEFAULT '[]'::jsonb,
    suspended            BOOLEAN NOT NULL DEFAULT FALSE,
    team_id              UUID REFERENCES teams(id) ON DELETE SET NULL,
    user_id              UUID,
    connected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_github_installations_team_id
    ON github_installations(team_id)
    WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_github_installations_user_id
    ON github_installations(user_id)
    WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS github_events (
    id               TEXT PRIMARY KEY,
    event_type       TEXT NOT NULL,
    action           TEXT,
    title            TEXT NOT NULL,
    body_preview     TEXT,
    repo_full_name   TEXT,
    actor_login      TEXT,
    html_url         TEXT,
    task_keys        JSONB NOT NULL DEFAULT '[]'::jsonb,
    installation_id  TEXT,
    delivery_id      TEXT,
    received_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_github_events_received_at
    ON github_events(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_github_events_installation_id
    ON github_events(installation_id)
    WHERE installation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS github_connect_states (
    state       TEXT PRIMARY KEY,
    user_id     TEXT,
    team_id     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_github_connect_states_created_at
    ON github_connect_states(created_at);
