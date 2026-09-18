/**
 * Loads and mutates tasks for the active team, plus the live member roster
 * used for assignee filters and ownership.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { api, ApiError } from "@/lib/api";
import {
  createDemoTask,
  deleteDemoTask,
  listDemoTasks,
  moveDemoTask,
  updateDemoTask,
} from "@/lib/tasks/demo";
import { membersToPeople, type TaskPerson } from "@/lib/tasks/display";
import type {
  Task,
  TaskCreate,
  TaskStatus,
  TaskStatusUpdate,
  TaskUpdate,
  TeamMemberWithUser,
} from "@/types";

function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return typeof err.message === "string" ? err.message : fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export function useTeamTasks() {
  const { user, isBypassMode } = useAuth();
  const { team } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMemberWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamId = team?.id ?? null;

  const people: TaskPerson[] = useMemo(
    () => membersToPeople(members, user),
    [members, user]
  );

  const refresh = useCallback(async () => {
    if (!teamId) {
      setTasks([]);
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isBypassMode) {
        setTasks(listDemoTasks(teamId));
        setMembers([]);
      } else {
        const [taskList, memberList] = await Promise.all([
          api.tasks.list(teamId),
          api.teams.listMembers(teamId),
        ]);
        setTasks(taskList);
        setMembers(memberList);
      }
    } catch (err) {
      setTasks([]);
      setMembers([]);
      setError(formatError(err, "Could not load tasks"));
    } finally {
      setLoading(false);
    }
  }, [teamId, isBypassMode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTask = useCallback(
    async (payload: TaskCreate) => {
      if (!teamId) throw new Error("No active team");
      const created = isBypassMode
        ? createDemoTask(teamId, payload)
        : await api.tasks.create(teamId, payload);
      setTasks((prev) => [...prev, created].sort((a, b) => a.position - b.position));
      return created;
    },
    [teamId, isBypassMode]
  );

  const updateTask = useCallback(
    async (taskId: string, payload: TaskUpdate) => {
      if (!teamId) throw new Error("No active team");
      const updated = isBypassMode
        ? updateDemoTask(taskId, payload)
        : await api.tasks.update(teamId, taskId, payload);
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? updated : task))
      );
      return updated;
    },
    [teamId, isBypassMode]
  );

  const moveTask = useCallback(
    async (taskId: string, payload: TaskStatusUpdate) => {
      if (!teamId) throw new Error("No active team");
      const updated = isBypassMode
        ? moveDemoTask(taskId, payload.status, payload.position)
        : await api.tasks.move(teamId, taskId, payload);
      setTasks((prev) =>
        prev
          .map((task) => (task.id === taskId ? updated : task))
          .sort((a, b) => a.position - b.position)
      );
      return updated;
    },
    [teamId, isBypassMode]
  );

  const removeTask = useCallback(
    async (taskId: string) => {
      if (!teamId) throw new Error("No active team");
      if (isBypassMode) {
        deleteDemoTask(taskId);
      } else {
        await api.tasks.delete(teamId, taskId);
      }
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
    [teamId, isBypassMode]
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
    isDemo: isBypassMode,
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
