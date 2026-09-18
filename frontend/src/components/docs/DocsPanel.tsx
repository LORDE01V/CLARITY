import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FileText, History, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import type {
  DocumentRevision,
  TeamDocument,
  TeamDocumentSummary,
} from "@/types";

interface Person {
  id: string;
  name: string;
}

interface DocsPanelProps {
  docs: TeamDocumentSummary[];
  active: TeamDocument | null;
  history: DocumentRevision[];
  people: Person[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  hasTeam: boolean;
  onOpen: (documentId: string) => Promise<unknown>;
  onClose: () => void;
  onCreate: (title: string, body: string) => Promise<void>;
  onSave: (
    documentId: string,
    input: { title: string; body: string; summary?: string }
  ) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  onRestore: (documentId: string, revisionId: string) => Promise<void>;
  onClearError: () => void;
}

const ATTRIBUTION_COLORS = [
  "#0F766E",
  "#B45309",
  "#1D4ED8",
  "#BE123C",
  "#7C3AED",
  "#047857",
  "#C2410C",
  "#0369A1",
];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return ATTRIBUTION_COLORS[hash % ATTRIBUTION_COLORS.length];
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocsPanel({
  docs,
  active,
  history,
  people,
  loading,
  saving,
  error,
  hasTeam,
  onOpen,
  onClose,
  onCreate,
  onSave,
  onDelete,
  onRestore,
  onClearError,
}: DocsPanelProps) {
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [summary, setSummary] = useState("");
  const [showHistory, setShowHistory] = useState(true);
  const [previewRevision, setPreviewRevision] = useState<DocumentRevision | null>(
    null
  );

  const peopleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const person of people) map.set(person.id, person.name);
    return map;
  }, [people]);

  useEffect(() => {
    if (!active) {
      setTitle("");
      setBody("");
      setSummary("");
      setPreviewRevision(null);
      return;
    }
    setTitle(active.title);
    setBody(active.body);
    setSummary("");
    setPreviewRevision(null);
  }, [active?.id, active?.updated_at]);

  const dirty =
    active != null && (title !== active.title || body !== active.body);

  const editors = useMemo(() => {
    const ids = new Set<string>();
    for (const rev of history) ids.add(rev.edited_by);
    if (active) {
      ids.add(active.created_by);
      ids.add(active.updated_by);
    }
    return [...ids];
  }, [history, active]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await onCreate(trimmed, "");
    setNewTitle("");
    setCreating(false);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!active || !dirty) return;
    await onSave(active.id, {
      title: title.trim(),
      body,
      summary: summary.trim() || undefined,
    });
  }

  if (!hasTeam) {
    return (
      <Panel className="p-6">
        <h1 className="text-[18px] font-semibold text-card-foreground">Docs</h1>
        <p className="mt-2 text-[13px] text-muted-light">
          Join or create a workspace team to keep shared documents.
        </p>
      </Panel>
    );
  }

  if (active) {
    const lastEditor =
      peopleById.get(active.updated_by) ?? "Teammate";
    const lastColor = colorForUser(active.updated_by);
    const viewing = previewRevision ?? null;

    return (
      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.75fr]">
        <Panel className="flex min-h-[70vh] flex-col p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <button
                type="button"
                className="clarity-focus text-[12px] font-semibold text-primary"
                onClick={onClose}
              >
                ← All docs
              </button>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-light">
                Last edited by{" "}
                <span
                  className="inline-flex items-center gap-1 font-semibold"
                  style={{ color: lastColor }}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: lastColor }}
                    aria-hidden
                  />
                  @{lastEditor}
                </span>{" "}
                · {formatWhen(active.updated_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowHistory((v) => !v)}
              >
                <History className="size-3.5" aria-hidden />
                History
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => {
                  if (window.confirm("Delete this document?")) {
                    void onDelete(active.id);
                  }
                }}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete
              </Button>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-[12px] text-destructive">
              {error}{" "}
              <button
                type="button"
                className="font-semibold underline-offset-2 hover:underline"
                onClick={onClearError}
              >
                Dismiss
              </button>
            </p>
          )}

          {viewing ? (
            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
              <div className="rounded-[var(--radius-sm)] border border-border-subtle bg-row-hover/70 px-3 py-2 text-[11px] text-muted-light">
                Viewing revision from {formatWhen(viewing.edited_at)} by @
                {peopleById.get(viewing.edited_by) ?? "Teammate"} — read only.
              </div>
              <h2 className="text-[20px] font-semibold text-card-foreground">
                {viewing.title}
              </h2>
              <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-[var(--radius-sm)] border border-border bg-background px-4 py-3 text-[13px] leading-6 text-card-foreground">
                {viewing.body || "Empty document."}
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPreviewRevision(null)}
                >
                  Back to editing
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={saving}
                  onClick={() => void onRestore(active.id, viewing.id)}
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Restore this version
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => void handleSave(e)}
              className="mt-4 flex min-h-0 flex-1 flex-col gap-3"
            >
              <input
                className="clarity-input text-[18px] font-semibold"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
              />
              <textarea
                className="clarity-input min-h-[420px] flex-1 resize-y font-mono text-[13px] leading-6"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write notes, protocols, research findings…"
              />
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[200px] flex-1 text-[12px] font-semibold text-card-foreground">
                  Change note (optional)
                  <input
                    className="clarity-input mt-1.5"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="e.g. Updated methods section"
                    maxLength={500}
                  />
                </label>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!dirty || saving || !title.trim()}
                >
                  {saving ? "Saving…" : "Save version"}
                </Button>
              </div>
            </form>
          )}
        </Panel>

        {showHistory && (
          <Panel className="p-0">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-[13px] font-semibold text-card-foreground">
                History & attribution
              </h2>
              <p className="mt-1 text-[11px] text-muted-light">
                Each save is a version. Colors mark who edited.
              </p>
            </div>
            {editors.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-border-subtle px-4 py-3">
                {editors.map((id) => {
                  const color = colorForUser(id);
                  const name = peopleById.get(id) ?? "Teammate";
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold"
                      style={{
                        color,
                        backgroundColor: `${color}18`,
                      }}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      @{name}
                    </span>
                  );
                })}
              </div>
            )}
            <ul className="max-h-[70vh] divide-y divide-border-subtle overflow-auto">
              {history.length === 0 ? (
                <li className="px-4 py-5 text-[12px] text-muted-light">
                  No revisions yet.
                </li>
              ) : (
                history.map((rev) => {
                  const color = colorForUser(rev.edited_by);
                  const name = peopleById.get(rev.edited_by) ?? "Teammate";
                  const selected = previewRevision?.id === rev.id;
                  return (
                    <li key={rev.id}>
                      <button
                        type="button"
                        className={`clarity-focus flex w-full flex-col items-start gap-1 px-4 py-3 text-left hover:bg-row-hover ${
                          selected ? "bg-row-hover" : ""
                        }`}
                        onClick={() => setPreviewRevision(rev)}
                      >
                        <span
                          className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
                          style={{ color }}
                        >
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: color }}
                            aria-hidden
                          />
                          @{name}
                        </span>
                        <span className="text-[11px] text-muted-light">
                          {formatWhen(rev.edited_at)}
                          {rev.summary ? ` · ${rev.summary}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </Panel>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-card-foreground">
            Docs
          </h1>
          <p className="mt-1 text-[13px] text-muted-light">
            Shared team documents with version history and who-edited-what.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setCreating(true)}
        >
          <Plus className="size-3.5" aria-hidden />
          New doc
        </Button>
      </div>

      {error && (
        <p className="text-[12px] text-destructive">
          {error}{" "}
          <button
            type="button"
            className="font-semibold underline-offset-2 hover:underline"
            onClick={onClearError}
          >
            Dismiss
          </button>
        </p>
      )}

      {creating && (
        <Panel className="p-5">
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="flex flex-wrap items-end gap-3"
          >
            <label className="min-w-[240px] flex-1 text-[12px] font-semibold text-card-foreground">
              Title
              <input
                className="clarity-input mt-1.5"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Research protocol v1"
                required
                maxLength={200}
                autoFocus
              />
            </label>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreating(false);
                setNewTitle("");
              }}
            >
              Cancel
            </Button>
          </form>
        </Panel>
      )}

      <Panel className="overflow-hidden">
        {loading ? (
          <p className="px-5 py-6 text-[12px] text-muted-light">Loading docs…</p>
        ) : docs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <FileText className="mx-auto size-8 text-muted-light" aria-hidden />
            <p className="mt-3 text-[14px] font-semibold text-card-foreground">
              No documents yet
            </p>
            <p className="mt-1 text-[12px] text-muted-light">
              Create a shared note, protocol, or findings report.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {docs.map((doc) => {
              const color = colorForUser(doc.updated_by);
              const name = peopleById.get(doc.updated_by) ?? "Teammate";
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    className="clarity-focus flex w-full flex-col items-start gap-1 px-5 py-4 text-left hover:bg-row-hover"
                    onClick={() => void onOpen(doc.id)}
                  >
                    <span className="text-[14px] font-semibold text-card-foreground">
                      {doc.title}
                    </span>
                    {doc.preview && (
                      <span className="line-clamp-2 text-[12px] text-muted-light">
                        {doc.preview}
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-light">
                      <span
                        className="inline-flex items-center gap-1 font-semibold"
                        style={{ color }}
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                        @{name}
                      </span>
                      · {formatWhen(doc.updated_at)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
