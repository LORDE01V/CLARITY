import { FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  GitPullRequest,
  Mic2,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { Task, TaskStatus } from "@/types";
import {
  DEMO_PEOPLE,
  NEXT_STATUS,
  cardSignals,
  dueTone,
  formatDueDate,
  resolvePerson,
  taskKey,
} from "@/lib/tasks/display";
import { cn } from "@/lib/utils";

interface TaskDetailDrawerProps {
  task: Task | null;
  open: boolean;
  busy: boolean;
  currentUser?: { id: string; full_name?: string | null; email?: string } | null;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    description: string;
    assignee_id: string | null;
    due_date: string | null;
  }) => Promise<void>;
  onMove: (status: TaskStatus) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function TaskDetailDrawer({
  task,
  open,
  busy,
  currentUser,
  onClose,
  onSave,
  onMove,
  onDelete,
}: TaskDetailDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setAssigneeId(task.assignee_id ?? "");
    setDueDate(task.due_date ?? "");
    setError(null);
  }, [task]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open, task?.id]);

  if (!open || !task) return null;

  const person = resolvePerson(task.assignee_id, currentUser);
  const next = NEXT_STATUS[task.status];
  const signals = cardSignals(task);
  const tone = dueTone(task.due_date, task.status);
  const dueLabel = formatDueDate(task.due_date);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="clarity-task-drawer-root" role="presentation">
      <button
        type="button"
        className="clarity-task-drawer-scrim"
        aria-label="Close task details"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="clarity-task-drawer"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div>
            <p className="font-mono text-[11px] font-medium tracking-wide text-primary">
              {taskKey(task.id)}
            </p>
            <h2 id={titleId} className="mt-1 text-[15px] font-semibold text-card-foreground">
              Task details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="clarity-icon-btn"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSave(e)}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4"
        >
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="clarity-input"
              maxLength={200}
              required
              disabled={busy || saving}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="clarity-input min-h-28 resize-y"
              maxLength={5000}
              disabled={busy || saving}
              placeholder="Context the team needs — decisions, constraints, links"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
              Assignee
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="clarity-input"
                disabled={busy || saving}
              >
                <option value="">Unassigned</option>
                {DEMO_PEOPLE.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {currentUser &&
                  !DEMO_PEOPLE.some((p) => p.id === currentUser.id) && (
                    <option value={currentUser.id}>
                      {currentUser.full_name || currentUser.email || "You"}
                    </option>
                  )}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="clarity-input"
                disabled={busy || saving}
              />
            </label>
          </div>

          <div className="rounded-[var(--radius-sm)] border border-border-subtle bg-row-hover/80 px-3 py-3">
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
              {person ? (
                <span className="inline-flex items-center gap-2">
                  <Avatar
                    initials={person.initials}
                    className="size-7 bg-accent text-primary"
                  />
                  {person.name}
                </span>
              ) : (
                <span>Unassigned</span>
              )}
              {dueLabel && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-medium tabular-nums",
                    tone === "overdue" && "text-destructive",
                    tone === "soon" && "text-[#a66b31]"
                  )}
                >
                  <CalendarDays className="size-3.5" aria-hidden />
                  {tone === "overdue" ? `Overdue ${dueLabel}` : `Due ${dueLabel}`}
                </span>
              )}
            </div>

            {signals.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {signals.map((signal) => (
                  <span
                    key={signal.kind}
                    className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--info-banner-border)] bg-accent/50 px-2 py-1 text-[11px] font-medium text-primary"
                    title="Placeholder — integrations land later"
                  >
                    {signal.kind === "pr" ? (
                      <GitPullRequest className="size-3.5" aria-hidden />
                    ) : (
                      <Mic2 className="size-3.5" aria-hidden />
                    )}
                    {signal.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="clarity-error">{error}</p>}

          <div className="mt-auto flex flex-wrap gap-2 border-t border-border-subtle pt-4">
            <Button
              type="submit"
              variant="primary"
              disabled={busy || saving || !title.trim()}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
            {next && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy || saving}
                onClick={() => void onMove(next)}
                className="gap-1"
              >
                {next === "in_progress" ? "Start" : "Complete"}
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            )}
            {task.status !== "todo" && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy || saving}
                onClick={() =>
                  void onMove(task.status === "done" ? "in_progress" : "todo")
                }
                className="gap-1"
              >
                <ArrowLeft className="size-3.5" aria-hidden />
                Back
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={busy || saving}
              onClick={() => void onDelete()}
              className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete task"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
