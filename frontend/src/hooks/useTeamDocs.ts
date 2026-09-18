/**
 * Team documents with revision history / attribution.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { api, ApiError } from "@/lib/api";
import { isRealAuthPathReady } from "@/lib/auth/config";
import type {
  DocumentCreate,
  DocumentRevision,
  DocumentUpdate,
  TeamDocument,
  TeamDocumentSummary,
} from "@/types";

function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message;
  return fallback;
}

export function useTeamDocs() {
  const { isBypassMode } = useAuth();
  const { team } = useWorkspace();
  const [docs, setDocs] = useState<TeamDocumentSummary[]>([]);
  const [active, setActive] = useState<TeamDocument | null>(null);
  const [history, setHistory] = useState<DocumentRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamId = team?.id ?? null;
  const live = isRealAuthPathReady() || !isBypassMode;

  const refresh = useCallback(async () => {
    if (!teamId || !live) {
      setDocs([]);
      setActive(null);
      setHistory([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDocs(await api.docs.list(teamId));
    } catch (err) {
      setError(formatError(err, "Could not load documents"));
    } finally {
      setLoading(false);
    }
  }, [teamId, live]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openDocument = useCallback(
    async (documentId: string) => {
      if (!teamId) return null;
      setError(null);
      try {
        const [doc, revisions] = await Promise.all([
          api.docs.get(teamId, documentId),
          api.docs.history(teamId, documentId),
        ]);
        setActive(doc);
        setHistory(revisions);
        return doc;
      } catch (err) {
        setError(formatError(err, "Could not open document"));
        return null;
      }
    },
    [teamId]
  );

  const closeDocument = useCallback(() => {
    setActive(null);
    setHistory([]);
  }, []);

  const createDocument = useCallback(
    async (payload: DocumentCreate) => {
      if (!teamId) throw new Error("No team selected");
      setSaving(true);
      setError(null);
      try {
        const created = await api.docs.create(teamId, payload);
        setDocs((prev) => [
          {
            id: created.id,
            team_id: created.team_id,
            title: created.title,
            preview: created.body.slice(0, 160),
            created_by: created.created_by,
            updated_by: created.updated_by,
            created_at: created.created_at,
            updated_at: created.updated_at,
          },
          ...prev,
        ]);
        setActive(created);
        setHistory(await api.docs.history(teamId, created.id));
        return created;
      } catch (err) {
        setError(formatError(err, "Could not create document"));
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [teamId]
  );

  const saveDocument = useCallback(
    async (documentId: string, payload: DocumentUpdate) => {
      if (!teamId) throw new Error("No team selected");
      setSaving(true);
      setError(null);
      try {
        const updated = await api.docs.update(teamId, documentId, payload);
        setActive(updated);
        setDocs((prev) =>
          prev
            .map((doc) =>
              doc.id === documentId
                ? {
                    ...doc,
                    title: updated.title,
                    preview: updated.body.slice(0, 160),
                    updated_by: updated.updated_by,
                    updated_at: updated.updated_at,
                  }
                : doc
            )
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        );
        setHistory(await api.docs.history(teamId, documentId));
        return updated;
      } catch (err) {
        setError(formatError(err, "Could not save document"));
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [teamId]
  );

  const removeDocument = useCallback(
    async (documentId: string) => {
      if (!teamId) throw new Error("No team selected");
      setSaving(true);
      setError(null);
      try {
        await api.docs.delete(teamId, documentId);
        setDocs((prev) => prev.filter((doc) => doc.id !== documentId));
        if (active?.id === documentId) {
          setActive(null);
          setHistory([]);
        }
      } catch (err) {
        setError(formatError(err, "Could not delete document"));
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [teamId, active?.id]
  );

  const restoreRevision = useCallback(
    async (documentId: string, revisionId: string) => {
      if (!teamId) throw new Error("No team selected");
      setSaving(true);
      setError(null);
      try {
        const updated = await api.docs.restore(teamId, documentId, revisionId);
        setActive(updated);
        setDocs((prev) =>
          prev.map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  title: updated.title,
                  preview: updated.body.slice(0, 160),
                  updated_by: updated.updated_by,
                  updated_at: updated.updated_at,
                }
              : doc
          )
        );
        setHistory(await api.docs.history(teamId, documentId));
        return updated;
      } catch (err) {
        setError(formatError(err, "Could not restore revision"));
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [teamId]
  );

  return {
    docs,
    active,
    history,
    loading,
    saving,
    error,
    hasTeam: Boolean(teamId),
    refresh,
    openDocument,
    closeDocument,
    createDocument,
    saveDocument,
    removeDocument,
    restoreRevision,
    clearError: () => setError(null),
  };
}
