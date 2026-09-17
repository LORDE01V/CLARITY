/**
 * Loads and mutates team meeting recaps via the live API (OpenAI on the backend).
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { api, ApiError } from "@/lib/api";
import { isRealAuthPathReady } from "@/lib/auth/config";
import type {
  MeetingRecap,
  RecapGenerateRequest,
  RecapSendRequest,
  RecapUpdateRequest,
} from "@/types";

function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message;
  return fallback;
}

export function useTeamRecaps() {
  const { isBypassMode } = useAuth();
  const { team } = useWorkspace();
  const [recaps, setRecaps] = useState<MeetingRecap[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamId = team?.id ?? null;
  const live = isRealAuthPathReady() || !isBypassMode;

  const refresh = useCallback(async () => {
    if (!teamId || !live) {
      setRecaps([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRecaps(await api.recaps.list(teamId));
    } catch (err) {
      setRecaps([]);
      setError(formatError(err, "Could not load recaps"));
    } finally {
      setLoading(false);
    }
  }, [teamId, live]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const generate = useCallback(
    async (payload: RecapGenerateRequest) => {
      if (!teamId) throw new Error("No active team");
      setGenerating(true);
      setError(null);
      try {
        const created = await api.recaps.generate(teamId, payload);
        setRecaps((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
        return created;
      } catch (err) {
        const message = formatError(err, "Could not generate recap");
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setGenerating(false);
      }
    },
    [teamId]
  );

  const update = useCallback(
    async (recapId: string, payload: RecapUpdateRequest) => {
      if (!teamId) throw new Error("No active team");
      const next = await api.recaps.update(teamId, recapId, payload);
      setRecaps((prev) => prev.map((r) => (r.id === next.id ? next : r)));
      return next;
    },
    [teamId]
  );

  const send = useCallback(
    async (recapId: string, payload: RecapSendRequest = {}) => {
      if (!teamId) throw new Error("No active team");
      const next = await api.recaps.send(teamId, recapId, payload);
      setRecaps((prev) => prev.map((r) => (r.id === next.id ? next : r)));
      return next;
    },
    [teamId]
  );

  return {
    recaps,
    loading,
    generating,
    error,
    hasTeam: Boolean(teamId),
    isLive: live,
    refresh,
    generate,
    update,
    send,
    clearError: () => setError(null),
  };
}
