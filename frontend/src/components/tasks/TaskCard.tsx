import { CalendarDays, Link2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { Task, TaskStatus } from "@/types";
import {
  dueTone,
  formatDueDate,
  parentLabel,
  resolvePerson,
  taskKey,
  type TaskPerson,
} from "@/lib/tasks/display";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  tasks: Task[];
  people: TaskPerson[];
  busy: boolean;
  selected: boolean;
  currentUser?: { id: string; full_name?: string | null; email?: string } | null;
  onOpen: (task: Task) => void;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Ready",
  in_progress: "Active",
  done: "Done",
};

export function TaskCard({
  task,
  tasks,
  people,
  busy,
  selected,
  currentUser,
  onOpen,
}: TaskCardProps) {
  const person = resolvePerson(task.assignee_id, people, currentUser);
  const dueLabel = formatDueDate(task.due_date);
  const tone = dueTone(task.due_date, task.status);
  const key = taskKey(task.id);
  const linked = parentLabel(task.parent_task_id, tasks);

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(task)}
        disabled={busy}
        className={cn(
          "clarity-task-card group w-full text-left",
          selected && "clarity-task-card--selected",
          busy && "opacity-60"
        )}
        aria-label={`${key}: ${task.title}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-[10px] font-medium tracking-wide text-primary/80">
            {key}
          </span>
          <div className="flex items-center gap-1.5">
            {task.story_points != null && (
              <span
                className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-card-foreground"
                title="Story points"
              >
                {task.story_points} pts
              </span>
            )}
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              task.status === "backlog" && "bg-secondary text-muted-foreground",
              task.status === "todo" && "bg-secondary text-text-subtle",
              task.status === "in_progress" && "bg-accent text-primary",
              task.status === "done" && "bg-secondary text-muted-foreground"
              )}
            >
              {STATUS_LABEL[task.status]}
            </span>
          </div>
        </div>

        <p className="mt-2 text-[13px] font-semibold leading-5 text-card-foreground">
          {task.title}
        </p>

        {task.description && (
          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
            {task.description}
          </p>
        )}

        {linked && (
          <p className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-[10px] font-medium text-primary">
            <Link2 className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{linked}</span>
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {dueLabel ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-medium tabular-nums",
                  tone === "overdue" && "text-destructive",
                  tone === "soon" && "text-[#a66b31]",
                  (tone === "ok" || tone === "none") && "text-muted-foreground"
                )}
              >
                <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                {tone === "overdue" ? `Overdue ${dueLabel}` : dueLabel}
              </span>
            ) : (
              <span className="text-[11px] text-muted-light">No due date</span>
            )}
          </div>

          {person ? (
            <span title={person.name}>
              <Avatar
                initials={person.initials}
                className="size-7 bg-accent text-primary ring-2 ring-white"
              />
            </span>
          ) : (
            <span
              className="flex size-7 items-center justify-center rounded-full border border-dashed border-[var(--border-dashed)] text-[10px] text-muted-light"
              title="Unassigned"
              aria-hidden
            >
              —
            </span>
          )}
        </div>
      </button>
    </li>
  );
}
