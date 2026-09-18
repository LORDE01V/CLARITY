export interface TeamDocumentSummary {
  id: string;
  team_id: string;
  title: string;
  preview: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamDocument {
  id: string;
  team_id: string;
  title: string;
  body: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRevision {
  id: string;
  document_id: string;
  team_id: string;
  title: string;
  body: string;
  edited_by: string;
  summary: string | null;
  edited_at: string;
}

export interface DocumentCreate {
  title: string;
  body?: string;
}

export interface DocumentUpdate {
  title?: string;
  body?: string;
  summary?: string | null;
}
