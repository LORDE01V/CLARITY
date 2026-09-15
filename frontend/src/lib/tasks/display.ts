/**
 * Display helpers for the Tasks board — keys, people, due dates.
 * Keeps presentation logic out of board components.
 */

import type { Task, TaskStatus } from "@/types";
import { DEMO_USER } from "@/lib/auth/bypass";

export interface TaskPerson {
  id: string;
  name: string;
  initials: string;
}

/** Demo roster for assignee avatars when the members API is not wired yet. */
export const DEMO_PEOPLE: TaskPerson[] = [
  {
    id: DEMO_USER.id,
    name: DEMO_USER.full_name ?? "Jordan Davis",
    initials: "JD",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Amira Chen",
    initials: "AC",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Sam Okonkwo",
    initials: "SO",
  },
];

const PEOPLE_BY_ID = new Map(DEMO_PEOPLE.map((person) => [person.id, person]));

export const COLUMN_META: {
  status: TaskStatus;
  title: string;
  hint: string;
  empty: string;
}[] = [
  {
    status: "todo",
    title: "Ready",
    hint: "Queued for ownership",
    empty: "Nothing waiting. Capture the next decision here.",
  },
  {
    status: "in_progress",
    title: "Active",
    hint: "Work in motion",
    empty: "Clear lane. Move a ready task when someone owns it.",
  },
  {
    status: "done",
    title: "Closed",
    hint: "Accounted for",
    empty: "Closed work lands here with its trail intact.",
  },
];

export const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  todo: "in_progress",
  in_progress: "done",
};

export function taskKey(taskId: string): string {
  const compact = taskId.replace(/-/g, "").slice(-4).toUpperCase();
  const numeric = Number.parseInt(compact, 16);
  const n = Number.isFinite(numeric) ? (numeric % 900) + 100 : 100;
  return `CLR-${n}`;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function resolvePerson(
  assigneeId: string | null | undefined,
  currentUser?: { id: string; full_name?: string | null; email?: string } | null
): TaskPerson | null {
  if (!assigneeId) return null;
  const known = PEOPLE_BY_ID.get(assigneeId);
  if (known) return known;
  if (currentUser?.id === assigneeId) {
    const name = currentUser.full_name?.trim() || currentUser.email || "You";
    return { id: assigneeId, name, initials: initialsFromName(name) };
  }
  return {
    id: assigneeId,
    name: "Teammate",
    initials: assigneeId.replace(/-/g, "").slice(0, 2).toUpperCase(),
  };
}

export function formatDueDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function dueTone(
  isoDate: string | null | undefined,
  status: TaskStatus
): "none" | "ok" | "soon" | "overdue" {
  if (!isoDate || status === "done") return "none";
  const due = new Date(`${isoDate}T23:59:59`);
  if (Number.isNaN(due.getTime())) return "ok";
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (diffMs < 0) return "overdue";
  if (diffMs <= 2 * dayMs) return "soon";
  return "ok";
}

export function matchesQuery(task: Task, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const key = taskKey(task.id).toLowerCase();
  const haystack = [task.title, task.description ?? "", key].join(" ").toLowerCase();
  return haystack.includes(q);
}

/** Synthetic workspace signals — UI affordances until integrations ship. */
export function cardSignals(task: Task): { kind: "pr" | "recap"; label: string }[] {
  const signals: { kind: "pr" | "recap"; label: string }[] = [];
  const seed = Number.parseInt(task.id.replace(/-/g, "").slice(-2), 16) || 0;
  if (task.status !== "todo" || seed % 3 === 0) {
    if (seed % 2 === 0) signals.push({ kind: "pr", label: "PR link" });
  }
  if (task.description?.toLowerCase().includes("recap") || seed % 5 === 0) {
    signals.push({ kind: "recap", label: "Meeting recap" });
  }
  return signals;
}
