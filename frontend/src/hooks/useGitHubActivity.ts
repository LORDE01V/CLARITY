/**
 * Loads GitHub activity from the API when possible.
 *
 * Real auth never falls back to fake “demo feed” rows — empty means waiting
 * for webhooks. Demo fixtures are only used in pure auth-bypass with no API.
 */

import { useCallback, useEffect, useState } from "react";
import { Circle, GitCommitHorizontal, GitPullRequest, MessageSquare, type LucideIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ACTIVITIES, type ActivityItem } from "@/data/dashboard";
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
  const useDemoFixtures = isBypassMode && !hasApiBaseUrl();
  const [items, setItems] = useState<ActivityItem[]>(
    useDemoFixtures ? ACTIVITIES : []
  );
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

    if (useDemoFixtures) {
      setItems(ACTIVITIES);
      setRaw([]);
      setIsLive(false);
      setLiveCount(0);
      setError(null);
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

    setLoading(true);
    try {
      const events = await api.github.activity(limit);
      setRaw(events);
      setLiveCount(events.length);
      setItems(events.map(mapGitHubActivity));
      setIsLive(events.length > 0);
      setError(null);
    } catch {
      setItems([]);
      setRaw([]);
      setIsLive(false);
      setLiveCount(0);
      setError("Could not load GitHub activity from the API.");
    } finally {
      setLoading(false);
    }
  }, [enabled, limit, useDemoFixtures]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || useDemoFixtures || !hasApiBaseUrl()) return;
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, refresh, useDemoFixtures]);

  const isDemo = useDemoFixtures;

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
