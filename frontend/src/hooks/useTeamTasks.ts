/**
 * Loads and mutates tasks for the active team, plus the live member roster.
 * Background polls merge quietly — no loading flicker (Jira-style).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { api, ApiError } from "@/lib/api";
import { hasApiBaseUrl } from "@/lib/auth/config";
import { membersToPeople, type TaskPerson } from "@/lib/tasks/display";
import type {
  Task,
  TaskCreate,
  TaskStatus,
  TaskStatusUpdate,
  TaskUpdate,
  TeamMemberWithUser,
} from "@/types";

const POLL_MS = 8000;

function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return typeof err.message === "string" ? err.message : fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

function sameTaskSnapshot(a: Task[], b: Task[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.id !== right.id ||
      left.updated_at !== right.updated_at ||
      left.status !== right.status ||
      left.position !== right.position ||
      left.title !== right.title ||
      left.assignee_id !== right.assignee_id ||
      left.story_points !== right.story_points ||
      left.parent_task_id !== right.parent_task_id ||
      left.due_date !== right.due_date
    ) {
      return false;
    }
  }
  return true;
}

export function useTeamTasks() {
  const { user } = useAuth();
  const { team } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMemberWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const pollBusy = useRef(false);

  const teamId = team?.id ?? null;

  const people: TaskPerson[] = useMemo(
    () => membersToPeople(members, user),
    [members, user]
  );

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);

      if (!teamId) {
        setTasks([]);
        setMembers([]);
        setLoading(false);
        setError(null);
        hasLoaded.current = false;
        return;
      }

      if (!hasApiBaseUrl()) {
        setTasks([]);
        setMembers([]);
        setError("API URL is not configured.");
        setLoading(false);
        return;
      }

      if (!silent && !hasLoaded.current) {
        setLoading(true);
      }

      try {
        const [taskList, memberList] = await Promise.all([
          api.tasks.list(teamId),
          api.teams.listMembers(teamId),
        ]);
        setTasks((prev) => (sameTaskSnapshot(prev, taskList) ? prev : taskList));
        setMembers((prev) => {
          if (
            prev.length === memberList.length &&
            prev.every(
              (member, index) =>
                member.user_id === memberList[index]?.user_id &&
                member.role === memberList[index]?.role
            )
          ) {
            return prev;
          }
          return memberList;
        });
        setError(null);
        hasLoaded.current = true;
      } catch (err) {
        if (!silent || !hasLoaded.current) {
          setTasks([]);
          setMembers([]);
          setError(formatError(err, "Could not load tasks"));
        }
      } finally {
        setLoading(false);
      }
    },
    [teamId]
  );

  useEffect(() => {
    hasLoaded.current = false;
    void refresh({ silent: false });
  }, [refresh]);

  useEffect(() => {
    if (!teamId || !hasApiBaseUrl()) return;

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
  }, [teamId, refresh]);

  const createTask = useCallback(
    async (payload: TaskCreate) => {
      if (!teamId) throw new Error("No active team");
      const created = await api.tasks.create(teamId, {
        ...payload,
        status: payload.status ?? "backlog",
      });
      setTasks((prev) => [...prev, created].sort((a, b) => a.position - b.position));
      return created;
    },
    [teamId]
  );

  const updateTask = useCallback(
    async (taskId: string, payload: TaskUpdate) => {
      if (!teamId) throw new Error("No active team");
      const updated = await api.tasks.update(teamId, taskId, payload);
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? updated : task))
      );
      return updated;
    },
    [teamId]
  );

  const moveTask = useCallback(
    async (taskId: string, payload: TaskStatusUpdate) => {
      if (!teamId) throw new Error("No active team");
      const updated = await api.tasks.move(teamId, taskId, payload);
      setTasks((prev) =>
        prev
          .map((task) => (task.id === taskId ? updated : task))
          .sort((a, b) => a.position - b.position)
      );
      return updated;
    },
    [teamId]
  );

  const removeTask = useCallback(
    async (taskId: string) => {
      if (!teamId) throw new Error("No active team");
      await api.tasks.delete(teamId, taskId);
      setTasks((prev) =>
        prev
          .filter((task) => task.id !== taskId)
          .map((task) =>
            task.parent_task_id === taskId
              ? { ...task, parent_task_id: null }
              : task
          )
      );
    },
    [teamId]
  );

  const clearError = useCallback(() => setError(null), []);

  const openCount = useMemo(
    () => tasks.filter((task) => task.status !== "done").length,
    [tasks]
  );

  const byStatus = useCallback(
    (status: TaskStatus) =>
      tasks
        .filter((task) => task.status === status)
        .sort((a, b) => a.position - b.position),
    [tasks]
  );

  return {
    tasks,
    people,
    members,
    loading,
    error,
    openCount,
    isDemo: false,
    hasTeam: Boolean(teamId),
    refresh,
    createTask,
    updateTask,
    moveTask,
    removeTask,
    clearError,
    byStatus,
  };
}
