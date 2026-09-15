/**
 * GitHub Connect status — polls /github/status and opens the App install URL.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { api } from "@/lib/api";
import { hasApiBaseUrl } from "@/lib/auth/config";
import type { GitHubStatus } from "@/types";

const STATUS_POLL_MS = 4000;

export function useGitHubConnect() {
  const { isBypassMode } = useAuth();
  const { team } = useWorkspace();
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [waitingForInstall, setWaitingForInstall] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const teamId = team?.id;

  const refresh = useCallback(async () => {
    if (!hasApiBaseUrl()) {
      setStatus(null);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const next = await api.github.status(false, teamId);
      setStatus(next);
      setError(null);
      if (next.connected) {
        setWaitingForInstall(false);
      }
    } catch {
      setError("Could not load GitHub connection status.");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!waitingForInstall || !hasApiBaseUrl()) {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = window.setInterval(() => {
      void refresh();
    }, STATUS_POLL_MS);

    return () => {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [waitingForInstall, refresh]);

  const connect = useCallback(async () => {
    if (!hasApiBaseUrl()) {
      setError("Set VITE_API_BASE_URL to connect GitHub.");
      return;
    }

    setConnecting(true);
    setError(null);
    try {
      const result = await api.github.connect(teamId);
      window.open(result.url, "_blank", "noopener,noreferrer");
      setWaitingForInstall(true);
      if (result.requires_session && isBypassMode) {
        setError(
          result.detail ||
            "Connect opened the install page. Return here after installing — linking needs a real session."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start GitHub Connect."
      );
    } finally {
      setConnecting(false);
    }
  }, [teamId, isBypassMode]);

  return {
    status,
    loading,
    connecting,
    waitingForInstall,
    error,
    isBypassMode,
    connected: Boolean(status?.connected),
    refresh,
    connect,
  };
}
