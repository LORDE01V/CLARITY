/**
 * In-memory task board for auth bypass / demo mode.
 * Keeps Tasks UI interactive without hitting the real API.
 */

import type { Task, TaskCreate, TaskStatus, TaskUpdate } from "@/types";
import { DEMO_USER } from "@/lib/auth/bypass";
import { DEMO_TEAM } from "@/lib/workspace/demo";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `demo-task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const seedParentId = "00000000-0000-0000-0000-000000000101";

const seed: Task[] = [
  {
    id: seedParentId,
    team_id: DEMO_TEAM.id,
    title: "Draft kickoff agenda",
    description: "Outline decisions so the recap can attribute owners.",
    status: "todo",
    assignee_id: DEMO_USER.id,
    due_date: daysFromNow(2),
    position: 0,
    story_points: 3,
    parent_task_id: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    team_id: DEMO_TEAM.id,
    title: "Fix invite acceptance path",
    description: "Bug against kickoff agenda work.",
    status: "todo",
    assignee_id: DEMO_USER.id,
    due_date: daysFromNow(5),
    position: 1,
    story_points: 2,
    parent_task_id: seedParentId,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "00000000-0000-0000-0000-000000000103",
    team_id: DEMO_TEAM.id,
    title: "Review onboarding copy",
    description: "Check tone against Clarity voice — clear, accountable.",
    status: "in_progress",
    assignee_id: DEMO_USER.id,
    due_date: daysFromNow(-1),
    position: 0,
    story_points: 5,
    parent_task_id: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "00000000-0000-0000-0000-000000000104",
    team_id: DEMO_TEAM.id,
    title: "Link GitHub webhook stubs",
    description: "Prepare the hand-off so PRs can surface on cards.",
    status: "in_progress",
    assignee_id: DEMO_USER.id,
    due_date: daysFromNow(7),
    position: 1,
    story_points: 8,
    parent_task_id: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "00000000-0000-0000-0000-000000000105",
    team_id: DEMO_TEAM.id,
    title: "Ship workspace shell",
    description: "Closed after the last planning recap.",
    status: "done",
    assignee_id: DEMO_USER.id,
    due_date: daysFromNow(-4),
    position: 0,
    story_points: 1,
    parent_task_id: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];

let demoTasks: Task[] = seed.map((task) => ({ ...task }));

function nextPosition(status: TaskStatus): number {
  const inColumn = demoTasks.filter((task) => task.status === status);
  if (inColumn.length === 0) return 0;
  return Math.max(...inColumn.map((task) => task.position)) + 1;
}

export function listDemoTasks(teamId: string, status?: TaskStatus): Task[] {
  return demoTasks
    .filter((task) => task.team_id === teamId)
    .filter((task) => (status ? task.status === status : true))
    .slice()
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

export function createDemoTask(teamId: string, payload: TaskCreate): Task {
  const status = payload.status ?? "todo";
  const position =
    payload.position != null ? payload.position : nextPosition(status);
  const stamp = nowIso();
  const task: Task = {
    id: newId(),
    team_id: teamId,
    title: payload.title.trim(),
    description: payload.description ?? null,
    status,
    assignee_id: payload.assignee_id ?? null,
    due_date: payload.due_date ?? null,
    position,
    story_points: payload.story_points ?? null,
    parent_task_id: payload.parent_task_id ?? null,
    created_at: stamp,
    updated_at: stamp,
  };
  demoTasks = [...demoTasks, task];
  return task;
}

export function updateDemoTask(taskId: string, payload: TaskUpdate): Task {
  const index = demoTasks.findIndex((task) => task.id === taskId);
  if (index < 0) {
    throw new Error("Task not found");
  }
  const current = demoTasks[index];
  const next: Task = {
    ...current,
    title: payload.title != null ? payload.title.trim() : current.title,
    description:
      payload.description !== undefined ? payload.description : current.description,
    assignee_id:
      payload.assignee_id !== undefined ? payload.assignee_id : current.assignee_id,
    due_date: payload.due_date !== undefined ? payload.due_date : current.due_date,
    position: payload.position != null ? payload.position : current.position,
    story_points:
      payload.story_points !== undefined
        ? payload.story_points
        : current.story_points,
    parent_task_id:
      payload.parent_task_id !== undefined
        ? payload.parent_task_id
        : current.parent_task_id,
    updated_at: nowIso(),
  };
  demoTasks = [
    ...demoTasks.slice(0, index),
    next,
    ...demoTasks.slice(index + 1),
  ];
  return next;
}

export function moveDemoTask(
  taskId: string,
  status: TaskStatus,
  position?: number | null
): Task {
  const index = demoTasks.findIndex((task) => task.id === taskId);
  if (index < 0) {
    throw new Error("Task not found");
  }
  const current = demoTasks[index];
  const next: Task = {
    ...current,
    status,
    position: position != null ? position : nextPosition(status),
    updated_at: nowIso(),
  };
  demoTasks = [
    ...demoTasks.slice(0, index),
    next,
    ...demoTasks.slice(index + 1),
  ];
  return next;
}

export function deleteDemoTask(taskId: string): void {
  demoTasks = demoTasks
    .filter((task) => task.id !== taskId)
    .map((task) =>
      task.parent_task_id === taskId ? { ...task, parent_task_id: null } : task
    );
}

export function resetDemoTasks(): void {
  demoTasks = seed.map((task) => ({ ...task }));
}
