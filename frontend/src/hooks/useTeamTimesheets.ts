/**
 * Team timesheets: task-linked hours + external work.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { api, ApiError } from "@/lib/api";
import { isRealAuthPathReady } from "@/lib/auth/config";
import type { TimeEntry, TimeEntryCreate, TimeEntryUpdate } from "@/types";

function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message;
  return fallback;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + diff);
  return next;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function useTeamTimesheets(weekOffset = 0) {
  const { isBypassMode } = useAuth();
  const { team } = useWorkspace();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamId = team?.id ?? null;
  const live = isRealAuthPathReady() || !isBypassMode;

  const week = useMemo(() => {
    const base = startOfWeek(new Date());
    const from = addDays(base, weekOffset * 7);
    const to = addDays(from, 6);
    return { from: toIsoDate(from), to: toIsoDate(to), fromDate: from, toDate: to };
  }, [weekOffset]);

  const refresh = useCallback(async () => {
    if (!teamId || !live) {
      setEntries([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setEntries(
        await api.timesheets.list(teamId, {
          date_from: week.from,
          date_to: week.to,
        })
      );
    } catch (err) {
      setError(formatError(err, "Could not load timesheets"));
    } finally {
      setLoading(false);
    }
  }, [teamId, live, week.from, week.to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createEntry = useCallback(
    async (payload: TimeEntryCreate) => {
      if (!teamId) throw new Error("No team selected");
      setSaving(true);
      setError(null);
      try {
        const created = await api.timesheets.create(teamId, payload);
        setEntries((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const message = formatError(err, "Could not log hours");
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [teamId]
  );

  const updateEntry = useCallback(
    async (entryId: string, payload: TimeEntryUpdate) => {
      if (!teamId) throw new Error("No team selected");
      setSaving(true);
      setError(null);
      try {
        const updated = await api.timesheets.update(teamId, entryId, payload);
        setEntries((prev) =>
          prev.map((entry) => (entry.id === entryId ? updated : entry))
        );
        return updated;
      } catch (err) {
        const message = formatError(err, "Could not update entry");
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [teamId]
  );

  const removeEntry = useCallback(
    async (entryId: string) => {
      if (!teamId) throw new Error("No team selected");
      setSaving(true);
      setError(null);
      try {
        await api.timesheets.delete(teamId, entryId);
        setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      } catch (err) {
        const message = formatError(err, "Could not delete entry");
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [teamId]
  );

  const totalHours = useMemo(
    () =>
      Math.round(entries.reduce((sum, entry) => sum + entry.hours, 0) * 100) /
      100,
    [entries]
  );

  return {
    entries,
    loading,
    saving,
    error,
    hasTeam: Boolean(teamId),
    week,
    totalHours,
    refresh,
    createEntry,
    updateEntry,
    removeEntry,
    clearError: () => setError(null),
  };
}
