/**
 * Display helpers for the Tasks board — keys, people, due dates.
 * Keeps presentation logic out of board components.
 */

import type { Task, TaskStatus, TeamMemberWithUser } from "@/types";

export interface TaskPerson {
  id: string;
  name: string;
  initials: string;
}

export const COLUMN_META: {
  status: TaskStatus;
  title: string;
  hint: string;
  empty: string;
}[] = [
  {
    status: "backlog",
    title: "Backlog",
    hint: "Ideas and unscheduled work",
    empty: "Backlog is empty. Capture work here before sprinting it.",
  },
  {
    status: "todo",
    title: "Ready",
    hint: "Queued for ownership",
    empty: "Nothing waiting. Pull from backlog when ready.",
  },
  {
    status: "in_progress",
    title: "Active",
    hint: "Work in motion",
    empty: "Clear lane. Move a ready task when someone owns it.",
  },
  {
    status: "done",
    title: "Done",
    hint: "Accounted for",
    empty: "Closed work lands here with its trail intact.",
  },
];

export const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  backlog: "todo",
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

export function membersToPeople(
  members: TeamMemberWithUser[],
  currentUser?: { id: string; full_name?: string | null; email?: string } | null
): TaskPerson[] {
  const byId = new Map<string, TaskPerson>();

  for (const member of members) {
    const name =
      member.full_name?.trim() || member.email?.trim() || "Teammate";
    byId.set(member.user_id, {
      id: member.user_id,
      name,
      initials: initialsFromName(name),
    });
  }

  if (currentUser?.id && !byId.has(currentUser.id)) {
    const name =
      currentUser.full_name?.trim() || currentUser.email?.trim() || "You";
    byId.set(currentUser.id, {
      id: currentUser.id,
      name,
      initials: initialsFromName(name),
    });
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function resolvePerson(
  assigneeId: string | null | undefined,
  people: TaskPerson[] = [],
  currentUser?: { id: string; full_name?: string | null; email?: string } | null
): TaskPerson | null {
  if (!assigneeId) return null;
  const known = people.find((person) => person.id === assigneeId);
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

export function parentLabel(
  parentTaskId: string | null | undefined,
  tasks: Task[]
): string | null {
  if (!parentTaskId) return null;
  const parent = tasks.find((task) => task.id === parentTaskId);
  if (!parent) return taskKey(parentTaskId);
  return `${taskKey(parent.id)} · ${parent.title}`;
}
