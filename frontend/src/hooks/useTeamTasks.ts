/**
 * Loads and mutates tasks for the active team.
 * Uses the real API when authenticated; demo store in bypass mode.
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
import type {
  Task,
  TaskCreate,
  TaskStatus,
  TaskStatusUpdate,
  TaskUpdate,
} from "@/types";

function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return typeof err.message === "string" ? err.message : fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export function useTeamTasks() {
  const { isBypassMode } = useAuth();
  const { team } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamId = team?.id ?? null;

  const refresh = useCallback(async () => {
    if (!teamId) {
      setTasks([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isBypassMode) {
        setTasks(listDemoTasks(teamId));
      } else {
        setTasks(await api.tasks.list(teamId));
      }
    } catch (err) {
      setTasks([]);
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
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
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
