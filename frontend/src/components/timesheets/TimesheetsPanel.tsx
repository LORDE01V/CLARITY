import { useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Clock3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import type { Task } from "@/types";
import type { TimeEntry } from "@/types";

interface Person {
  id: string;
  name: string;
}

interface TimesheetsPanelProps {
  entries: TimeEntry[];
  tasks: Task[];
  people: Person[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  hasTeam: boolean;
  currentUserId: string;
  weekLabel: string;
  totalHours: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
  onCreate: (input: {
    work_date: string;
    hours: number;
    task_id: string | null;
    title: string | null;
    description: string | null;
  }) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
  onClearError: () => void;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHours(hours: number): string {
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 2)}h`;
}

export function TimesheetsPanel({
  entries,
  tasks,
  people,
  loading,
  saving,
  error,
  hasTeam,
  currentUserId,
  weekLabel,
  totalHours,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  onCreate,
  onDelete,
  onClearError,
}: TimesheetsPanelProps) {
  const [workDate, setWorkDate] = useState(todayIso);
  const [hours, setHours] = useState("1");
  const [mode, setMode] = useState<"task" | "external">("task");
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const peopleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const person of people) map.set(person.id, person.name);
    return map;
  }, [people]);

  const tasksById = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) map.set(task.id, task.title);
    return map;
  }, [tasks]);

  const openTasks = useMemo(
    () =>
      [...tasks]
        .filter((task) => task.status !== "done")
        .sort((a, b) => a.title.localeCompare(b.title)),
    [tasks]
  );

  const visible = useMemo(
    () =>
      mineOnly
        ? entries.filter((entry) => entry.user_id === currentUserId)
        : entries,
    [entries, mineOnly, currentUserId]
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(hours);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    await onCreate({
      work_date: workDate,
      hours: parsed,
      task_id: mode === "task" ? taskId || null : null,
      title: mode === "external" ? title.trim() || null : null,
      description: description.trim() || null,
    });

    setHours("1");
    setTitle("");
    setDescription("");
  }

  if (!hasTeam) {
    return (
      <Panel className="p-6">
        <h1 className="text-[18px] font-semibold text-card-foreground">Timesheets</h1>
        <p className="mt-2 text-[13px] text-muted-light">
          Join or create a workspace team to log hours.
        </p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-card-foreground">
            Timesheets
          </h1>
          <p className="mt-1 text-[13px] text-muted-light">
            Log hours on Clarity tasks or external work outside the board.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onPrevWeek}>
            <ChevronLeft className="size-3.5" aria-hidden />
            Prev
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onThisWeek}>
            This week
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onNextWeek}>
            Next
            <ChevronRight className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        <span className="font-semibold text-card-foreground">{weekLabel}</span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 font-semibold tabular-nums text-card-foreground">
          <Clock3 className="size-3.5" aria-hidden />
          {formatHours(totalHours)} logged
        </span>
        <label className="ml-auto inline-flex items-center gap-2 text-muted-light">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="size-3.5 accent-[var(--color-primary)]"
          />
          Only my entries
        </label>
      </div>

      {error && (
        <p className="text-[12px] text-destructive">
          {error}{" "}
          <button
            type="button"
            className="font-semibold underline-offset-2 hover:underline"
            onClick={onClearError}
          >
            Dismiss
          </button>
        </p>
      )}

      <Panel className="p-5">
        <h2 className="text-[13px] font-semibold text-card-foreground">Log time</h2>
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        >
          <label className="text-[12px] font-semibold text-card-foreground lg:col-span-1">
            Date
            <input
              type="date"
              className="clarity-input mt-1.5"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              required
            />
          </label>
          <label className="text-[12px] font-semibold text-card-foreground lg:col-span-1">
            Hours
            <input
              type="number"
              min="0.25"
              max="24"
              step="0.25"
              className="clarity-input mt-1.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              required
            />
          </label>
          <div className="lg:col-span-2">
            <p className="text-[12px] font-semibold text-card-foreground">Work type</p>
            <div className="mt-1.5 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "task" ? "primary" : "secondary"}
                onClick={() => setMode("task")}
              >
                Task
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "external" ? "primary" : "secondary"}
                onClick={() => setMode("external")}
              >
                External
              </Button>
            </div>
          </div>
          {mode === "task" ? (
            <label className="text-[12px] font-semibold text-card-foreground sm:col-span-2 lg:col-span-2">
              Task
              <select
                className="clarity-input mt-1.5"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                required
              >
                <option value="">Select a task…</option>
                {openTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-[12px] font-semibold text-card-foreground sm:col-span-2 lg:col-span-2">
              External work
              <input
                className="clarity-input mt-1.5"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lab sampling offsite"
                required
                maxLength={200}
              />
            </label>
          )}
          <label className="text-[12px] font-semibold text-card-foreground sm:col-span-2 lg:col-span-4">
            Notes
            <input
              className="clarity-input mt-1.5"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              maxLength={2000}
            />
          </label>
          <div className="flex items-end lg:col-span-2">
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={saving || (mode === "task" && !taskId)}
            >
              {saving ? "Saving…" : "Add entry"}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-[13px] font-semibold text-card-foreground">
            Week entries
          </h2>
        </div>
        {loading ? (
          <p className="px-5 py-6 text-[12px] text-muted-light">Loading timesheets…</p>
        ) : visible.length === 0 ? (
          <p className="px-5 py-6 text-[12px] text-muted-light">
            No hours logged this week yet.
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {visible.map((entry) => {
              const who = peopleById.get(entry.user_id) ?? "Teammate";
              const label =
                entry.task_id != null
                  ? tasksById.get(entry.task_id) ?? "Linked task"
                  : entry.title ?? "External work";
              const canDelete = entry.user_id === currentUserId;
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-card-foreground">
                      {label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-light">
                      {entry.work_date} · {who}
                      {entry.task_id == null ? " · External" : " · Task"}
                      {entry.description ? ` · ${entry.description}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold tabular-nums text-card-foreground">
                      {formatHours(entry.hours)}
                    </span>
                    {canDelete && (
                      <button
                        type="button"
                        aria-label="Delete entry"
                        className="clarity-focus flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"
                        disabled={saving}
                        onClick={() => void onDelete(entry.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
