import { CalendarDays, GitPullRequest, Mic2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { Task, TaskStatus } from "@/types";
import {
  cardSignals,
  dueTone,
  formatDueDate,
  resolvePerson,
  taskKey,
} from "@/lib/tasks/display";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  busy: boolean;
  selected: boolean;
  currentUser?: { id: string; full_name?: string | null; email?: string } | null;
  onOpen: (task: Task) => void;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Ready",
  in_progress: "Active",
  done: "Closed",
};

export function TaskCard({
  task,
  busy,
  selected,
  currentUser,
  onOpen,
}: TaskCardProps) {
  const person = resolvePerson(task.assignee_id, currentUser);
  const dueLabel = formatDueDate(task.due_date);
  const tone = dueTone(task.due_date, task.status);
  const signals = cardSignals(task);
  const key = taskKey(task.id);

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
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              task.status === "todo" && "bg-secondary text-text-subtle",
              task.status === "in_progress" && "bg-accent text-primary",
              task.status === "done" && "bg-secondary text-muted-foreground"
            )}
          >
            {STATUS_LABEL[task.status]}
          </span>
        </div>

        <p className="mt-2 text-[13px] font-semibold leading-5 text-card-foreground">
          {task.title}
        </p>

        {task.description && (
          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
            {task.description}
          </p>
        )}

        {signals.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {signals.map((signal) => (
              <span
                key={signal.kind}
                className="inline-flex items-center gap-1 rounded-md bg-accent/70 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                title={`${signal.label} — coming soon`}
              >
                {signal.kind === "pr" ? (
                  <GitPullRequest className="size-3" aria-hidden />
                ) : (
                  <Mic2 className="size-3" aria-hidden />
                )}
                {signal.label}
              </span>
            ))}
          </div>
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
