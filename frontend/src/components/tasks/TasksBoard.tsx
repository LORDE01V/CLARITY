import { useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { TaskColumn } from "@/components/tasks/TaskColumn";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { TaskToolbar, type BoardFilter } from "@/components/tasks/TaskToolbar";
import type { Task, TaskStatus } from "@/types";
import {
  COLUMN_META,
  dueTone,
  matchesQuery,
  type TaskPerson,
} from "@/lib/tasks/display";
import { cn } from "@/lib/utils";

export interface TaskCreateInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  assignee_id?: string | null;
  due_date?: string | null;
  story_points?: number | null;
  parent_task_id?: string | null;
}

export interface TaskUpdateInput {
  title: string;
  description: string;
  assignee_id: string | null;
  due_date: string | null;
  story_points: number | null;
  parent_task_id: string | null;
}

interface TasksBoardProps {
  tasks: Task[];
  people: TaskPerson[];
  loading: boolean;
  error: string | null;
  hasTeam: boolean;
  currentUser?: { id: string; full_name?: string | null; email?: string } | null;
  onCreate: (input: TaskCreateInput) => Promise<void>;
  onUpdate: (taskId: string, input: TaskUpdateInput) => Promise<void>;
  onMove: (taskId: string, status: TaskStatus) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onClearError: () => void;
}

export function TasksBoard({
  tasks,
  people,
  loading,
  error,
  hasTeam,
  currentUser,
  onCreate,
  onUpdate,
  onMove,
  onDelete,
  onClearError,
}: TasksBoardProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const selected = useMemo(
    () => tasks.find((task) => task.id === selectedId) ?? null,
    [tasks, selectedId]
  );

  useEffect(() => {
    if (selectedId && !tasks.some((task) => task.id === selectedId)) {
      setSelectedId(null);
    }
  }, [tasks, selectedId]);

  useEffect(() => {
    if (
      assigneeFilter &&
      !people.some((person) => person.id === assigneeFilter)
    ) {
      setAssigneeFilter(null);
    }
  }, [people, assigneeFilter]);

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (!matchesQuery(task, query)) return false;
      if (assigneeFilter && task.assignee_id !== assigneeFilter) return false;
      if (filter === "mine") {
        if (!currentUser?.id || task.assignee_id !== currentUser.id) return false;
      }
      if (filter === "unassigned" && task.assignee_id) return false;
      if (filter === "overdue" && dueTone(task.due_date, task.status) !== "overdue") {
        return false;
      }
      return true;
    });
  }, [tasks, query, filter, assigneeFilter, currentUser?.id]);

  const filteredByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const task of filtered) {
      map[task.status].push(task);
    }
    for (const status of Object.keys(map) as TaskStatus[]) {
      map[status].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [filtered]);

  async function withBusy(taskId: string | null, action: () => Promise<void>) {
    if (taskId) setBusyId(taskId);
    setLocalError(null);
    onClearError();
    try {
      await action();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Something went wrong");
      throw err;
    } finally {
      setBusyId(null);
    }
  }

  if (!hasTeam) {
    return (
      <Panel className="p-5 sm:p-6">
        <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-card-foreground">
          Tasks
        </h1>
        <p className="mt-2 max-w-md text-[13px] leading-6 text-muted-foreground">
          Select or create a team workspace to open the accountability board —
          where owners, due dates, story points, and linked work meet.
        </p>
      </Panel>
    );
  }

  const surfaceError = localError ?? error;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-card-foreground">
          Tasks
        </h1>
        <p className="max-w-2xl text-[13px] leading-6 text-muted-foreground">
          Own the work that meetings decide. Start in Backlog, move to Ready
          when scheduled, set story points, and link bugs to a parent task.
        </p>
      </header>

      <Panel className="overflow-hidden p-4 sm:p-5">
        <TaskToolbar
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={setFilter}
          assigneeId={assigneeFilter}
          onAssigneeChange={setAssigneeFilter}
          people={people}
          currentUserId={currentUser?.id}
          total={tasks.length}
          visible={filtered.length}
        />

        {surfaceError && (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-destructive/25 bg-destructive/5 px-3 py-2.5"
            role="alert"
          >
            <p className="text-[13px] text-destructive">{surfaceError}</p>
            <button
              type="button"
              className="clarity-focus text-[12px] font-semibold text-destructive underline-offset-2 hover:underline"
              onClick={() => {
                setLocalError(null);
                onClearError();
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-4" aria-busy="true" aria-live="polite">
            {COLUMN_META.map((column) => (
              <div key={column.status} className="flex flex-col gap-3">
                <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
                <div className="clarity-task-skeleton h-28" />
                <div className="clarity-task-skeleton h-24 opacity-70" />
                <div className="clarity-task-skeleton h-20 opacity-40" />
              </div>
            ))}
            <span className="sr-only">Loading tasks</span>
          </div>
        ) : (
          <div
            className={cn(
              "clarity-task-board mt-5 flex gap-4 overflow-x-auto pb-2",
              "xl:grid xl:grid-cols-4 xl:overflow-visible xl:pb-0"
            )}
          >
            {COLUMN_META.map((column) => (
              <TaskColumn
                key={column.status}
                status={column.status}
                title={column.title}
                hint={column.hint}
                empty={column.empty}
                tasks={filteredByStatus[column.status]}
                allTasks={tasks}
                people={people}
                busyId={busyId}
                selectedId={selectedId}
                currentUser={currentUser}
                onOpen={(task) => setSelectedId(task.id)}
                onCreate={async (title, status) => {
                  await withBusy(null, async () => {
                    await onCreate({
                      title,
                      status,
                      assignee_id: currentUser?.id ?? null,
                    });
                  });
                }}
              />
            ))}
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="mt-6 rounded-[var(--radius-md)] border border-dashed border-[var(--border-dashed)] bg-accent/30 px-5 py-10 text-center">
            <p className="text-[14px] font-semibold text-card-foreground">
              Board is clear
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-muted-foreground">
              Create in Backlog to capture upcoming work, then move cards into
              Ready and Active. Open a card for story points or parent links.
            </p>
          </div>
        )}

        {!loading && tasks.length > 0 && filtered.length === 0 && (
          <p className="mt-6 text-center text-[13px] text-muted-foreground">
            No tasks match this search or filter. Clear filters to see the full
            board.
          </p>
        )}
      </Panel>

      <TaskDetailDrawer
        task={selected}
        tasks={tasks}
        people={people}
        open={Boolean(selected)}
        busy={busyId === selected?.id}
        currentUser={currentUser}
        onClose={() => setSelectedId(null)}
        onSave={async (payload) => {
          if (!selected) return;
          await withBusy(selected.id, async () => {
            await onUpdate(selected.id, payload);
          });
        }}
        onMove={async (status) => {
          if (!selected) return;
          await withBusy(selected.id, async () => {
            await onMove(selected.id, status);
          });
        }}
        onDelete={async () => {
          if (!selected) return;
          const id = selected.id;
          await withBusy(id, async () => {
            await onDelete(id);
            setSelectedId(null);
          });
        }}
      />
    </div>
  );
}
