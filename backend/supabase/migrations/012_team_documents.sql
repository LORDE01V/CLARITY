-- Team documents with revision history / edit attribution.
-- Backend uses the service role key (bypasses RLS).

CREATE TABLE IF NOT EXISTS team_documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    created_by  UUID NOT NULL,
    updated_by  UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_documents_team_updated
    ON team_documents(team_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS team_document_revisions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID NOT NULL REFERENCES team_documents(id) ON DELETE CASCADE,
    team_id      UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    body         TEXT NOT NULL DEFAULT '',
    edited_by    UUID NOT NULL,
    summary      TEXT,
    edited_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_document_revisions_doc_edited
    ON team_document_revisions(document_id, edited_at DESC);

ALTER TABLE team_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_document_revisions ENABLE ROW LEVEL SECURITY;
