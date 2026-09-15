/**
 * Loads GitHub activity from the API when possible.
 * Falls back to demo fixtures in auth bypass mode or on API failure.
 *
 * In bypass/demo mode we still poll the local activity endpoint (no JWT
 * required when backend APP_ENV is development) so ingested webhooks can
 * surface as proof-of-life without Supabase.
 */

import { useCallback, useEffect, useState } from "react";
import { Circle, GitPullRequest, MessageSquare, type LucideIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ACTIVITIES, type ActivityItem } from "@/data/dashboard";
import { api } from "@/lib/api";
import { hasApiBaseUrl } from "@/lib/auth/config";
import type { GitHubActivityItem } from "@/types";

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
  return Circle;
}

function toneForEvent(eventType: string): string {
  if (eventType === "pull_request") return "text-primary bg-accent";
  if (eventType === "issue_comment") return "text-chart-3 bg-[#f7ebdb]";
  return "text-chart-4 bg-secondary";
}

export function mapGitHubActivity(item: GitHubActivityItem): ActivityItem {
  const keys =
    item.task_keys.length > 0 ? ` · ${item.task_keys.join(", ")}` : "";
  const repo = item.repo_full_name ? `${item.repo_full_name}` : "GitHub";
  const actor = item.actor_login ? `${item.actor_login} · ` : "";
  return {
    icon: iconForEvent(item.event_type),
    title: item.title,
    desc: `${actor}${repo}${keys}`,
    time: relativeTime(item.received_at),
    tone: toneForEvent(item.event_type),
  };
}

export function useGitHubActivity(limit = 20, enabled = true) {
  const { isBypassMode } = useAuth();
  const [items, setItems] = useState<ActivityItem[]>(ACTIVITIES);
  const [raw, setRaw] = useState<GitHubActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Bypass without an API base: stay on pure demo fixtures.
    if (isBypassMode && !hasApiBaseUrl()) {
      setItems(ACTIVITIES);
      setRaw([]);
      setIsLive(false);
      setLiveCount(0);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const events = await api.github.activity(limit);
      setRaw(events);
      setLiveCount(events.length);
      if (events.length === 0) {
        setItems(ACTIVITIES);
        setIsLive(false);
        setError(null);
      } else {
        setItems(events.map(mapGitHubActivity));
        setIsLive(true);
        setError(null);
      }
    } catch {
      setItems(ACTIVITIES);
      setRaw([]);
      setIsLive(false);
      setLiveCount(0);
      setError(
        isBypassMode
          ? "Could not reach local GitHub activity API; showing demo data."
          : "Could not load GitHub activity; showing demo data."
      );
    } finally {
      setLoading(false);
    }
  }, [enabled, isBypassMode, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Demo banner when bypass is on, unless we already swapped to live events.
  const isDemo = isBypassMode ? !isLive : !isLive;

  return {
    items,
    raw,
    loading,
    isLive,
    liveCount,
    error,
    isDemo,
    isBypassMode,
    refresh,
  };
}
