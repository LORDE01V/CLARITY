/**
 * Loads GitHub activity from the API.
 * Background polls merge quietly — no loading flicker.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, GitCommitHorizontal, GitPullRequest, MessageSquare, type LucideIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import type { ActivityItem } from "@/data/dashboard";
import { api } from "@/lib/api";
import { hasApiBaseUrl } from "@/lib/auth/config";
import type { GitHubActivityItem } from "@/types";

const POLL_MS = 15000;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function iconForEvent(eventType: string): LucideIcon {
  if (eventType === "pull_request") return GitPullRequest;
  if (eventType === "issue_comment") return MessageSquare;
  if (eventType === "push") return GitCommitHorizontal;
  return Circle;
}

function toneForEvent(eventType: string): string {
  if (eventType === "pull_request") return "text-primary bg-accent";
  if (eventType === "issue_comment") return "text-chart-3 bg-[#f7ebdb]";
  if (eventType === "push") return "text-primary bg-accent";
  return "text-chart-4 bg-secondary";
}

export function mapGitHubActivity(item: GitHubActivityItem): ActivityItem {
  const keys =
    item.task_keys.length > 0 ? ` · ${item.task_keys.join(", ")}` : "";
  const repo = item.repo_full_name ? `${item.repo_full_name}` : "GitHub";
  const actor = item.actor_login ? `${item.actor_login} · ` : "";
  const preview = item.body_preview ? ` — ${item.body_preview}` : "";
  return {
    icon: iconForEvent(item.event_type),
    title: item.title,
    desc: `${actor}${repo}${keys}${preview}`,
    time: relativeTime(item.received_at),
    tone: toneForEvent(item.event_type),
  };
}

export function useGitHubActivity(limit = 20, enabled = true) {
  const { isBypassMode } = useAuth();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [raw, setRaw] = useState<GitHubActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const pollBusy = useRef(false);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);

      if (!enabled) {
        setLoading(false);
        return;
      }

      if (!hasApiBaseUrl()) {
        setItems([]);
        setRaw([]);
        setIsLive(false);
        setLiveCount(0);
        setError("API URL is not configured.");
        setLoading(false);
        return;
      }

      if (!silent && !hasLoaded.current) {
        setLoading(true);
      }

      try {
        const events = await api.github.activity(limit);
        setRaw(events);
        setLiveCount(events.length);
        setItems(events.map(mapGitHubActivity));
        setIsLive(events.length > 0);
        setError(null);
        hasLoaded.current = true;
      } catch {
        if (!silent || !hasLoaded.current) {
          setItems([]);
          setRaw([]);
          setIsLive(false);
          setLiveCount(0);
          setError("Could not load GitHub activity from the API.");
        }
      } finally {
        setLoading(false);
      }
    },
    [enabled, limit]
  );

  useEffect(() => {
    hasLoaded.current = false;
    void refresh({ silent: false });
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !hasApiBaseUrl()) return;

    const tick = async () => {
      if (pollBusy.current) return;
      pollBusy.current = true;
      try {
        await refresh({ silent: true });
      } finally {
        pollBusy.current = false;
      }
    };

    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  return {
    items,
    raw,
    loading,
    isLive,
    liveCount,
    error,
    isDemo: false,
    isBypassMode,
    refresh,
  };
}
