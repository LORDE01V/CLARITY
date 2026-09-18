import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Link2,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { Task, TaskStatus } from "@/types";
import {
  NEXT_STATUS,
  dueTone,
  formatDueDate,
  parentLabel,
  resolvePerson,
  taskKey,
  type TaskPerson,
} from "@/lib/tasks/display";
import { cn } from "@/lib/utils";

interface TaskDetailDrawerProps {
  task: Task | null;
  tasks: Task[];
  people: TaskPerson[];
  open: boolean;
  busy: boolean;
  currentUser?: { id: string; full_name?: string | null; email?: string } | null;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    description: string;
    assignee_id: string | null;
    due_date: string | null;
    story_points: number | null;
    parent_task_id: string | null;
  }) => Promise<void>;
  onMove: (status: TaskStatus) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function TaskDetailDrawer({
  task,
  tasks,
  people,
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
  const [storyPoints, setStoryPoints] = useState("");
  const [parentTaskId, setParentTaskId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setAssigneeId(task.assignee_id ?? "");
    setDueDate(task.due_date ?? "");
    setStoryPoints(task.story_points != null ? String(task.story_points) : "");
    setParentTaskId(task.parent_task_id ?? "");
    setError(null);
    // Only re-hydrate when the opened task identity/version changes — not on every poll.
  }, [task?.id, task?.updated_at]);

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

  const parentOptions = useMemo(() => {
    if (!task) return [];
    return tasks
      .filter((item) => item.id !== task.id)
      .filter((item) => item.parent_task_id !== task.id)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks, task]);

  if (!open || !task) return null;

  const person = resolvePerson(task.assignee_id, people, currentUser);
  const next = NEXT_STATUS[task.status];
  const tone = dueTone(task.due_date, task.status);
  const dueLabel = formatDueDate(task.due_date);
  const linked = parentLabel(task.parent_task_id, tasks);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    const pointsRaw = storyPoints.trim();
    let points: number | null = null;
    if (pointsRaw) {
      const parsed = Number.parseInt(pointsRaw, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
        setError("Story points must be a whole number from 1 to 100");
        return;
      }
      points = parsed;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
        story_points: points,
        parent_task_id: parentTaskId || null,
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
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {currentUser &&
                  !people.some((p) => p.id === currentUser.id) && (
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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
              Story points
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                className="clarity-input"
                disabled={busy || saving}
                placeholder="e.g. 3"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
              Parent task
              <select
                value={parentTaskId}
                onChange={(e) => setParentTaskId(e.target.value)}
                className="clarity-input"
                disabled={busy || saving}
              >
                <option value="">None</option>
                {parentOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {taskKey(item.id)} · {item.title}
                  </option>
                ))}
              </select>
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
              {task.story_points != null && (
                <span className="font-medium tabular-nums text-card-foreground">
                  {task.story_points} pts
                </span>
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

            {linked && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
                <Link2 className="size-3.5" aria-hidden />
                Linked to {linked}
              </p>
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
                {next === "todo"
                  ? "Ready"
                  : next === "in_progress"
                    ? "Start"
                    : "Complete"}
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            )}
            {task.status !== "backlog" && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy || saving}
                onClick={() => {
                  const prev =
                    task.status === "done"
                      ? "in_progress"
                      : task.status === "in_progress"
                        ? "todo"
                        : "backlog";
                  void onMove(prev);
                }}
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
