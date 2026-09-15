import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TaskCard } from "@/components/tasks/TaskCard";
import type { Task, TaskStatus } from "@/types";
import { cn } from "@/lib/utils";

interface TaskColumnProps {
  status: TaskStatus;
  title: string;
  hint: string;
  empty: string;
  tasks: Task[];
  busyId: string | null;
  selectedId: string | null;
  currentUser?: { id: string; full_name?: string | null; email?: string } | null;
  onOpen: (task: Task) => void;
  onCreate: (title: string, status: TaskStatus) => Promise<void>;
}

export function TaskColumn({
  status,
  title,
  hint,
  empty,
  tasks,
  busyId,
  selectedId,
  currentUser,
  onOpen,
  onCreate,
}: TaskColumnProps) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(draft.trim(), status);
      setDraft("");
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setSubmitting(false);
    }
  }

  function cancelCreate() {
    setCreating(false);
    setDraft("");
    setError(null);
  }

  return (
    <section
      className="clarity-task-column flex min-h-[28rem] min-w-[17.5rem] flex-1 flex-col"
      aria-labelledby={labelId}
    >
      <header className="mb-3 flex items-start justify-between gap-2 px-1">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                status === "todo" && "bg-muted-light",
                status === "in_progress" && "bg-primary",
                status === "done" && "bg-[#5a9e74]"
              )}
              aria-hidden
            />
            <h2 id={labelId} className="text-[13px] font-semibold text-card-foreground">
              {title}
            </h2>
            <span className="tabular-nums text-[11px] font-medium text-muted-light">
              {tasks.length}
            </span>
          </div>
          <p className="mt-0.5 pl-4 text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </header>

      <ul className="flex flex-1 flex-col gap-2.5">
        {tasks.length === 0 && !creating && (
          <li className="clarity-task-empty rounded-[var(--radius-sm)] px-3 py-8 text-center text-[12px] leading-5 text-muted-light">
            {empty}
          </li>
        )}

        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            busy={busyId === task.id}
            selected={selectedId === task.id}
            currentUser={currentUser}
            onOpen={onOpen}
          />
        ))}
      </ul>

      <div className="mt-3">
        {creating ? (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelCreate();
                }
              }}
              className="clarity-input min-h-10 py-2 text-[13px]"
              placeholder="Task title"
              maxLength={200}
              aria-label={`New task in ${title}`}
              disabled={submitting}
            />
            {error && <p className="clarity-error text-[12px]">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting || !draft.trim()}
              >
                {submitting ? "Adding..." : "Add"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={submitting}
                onClick={cancelCreate}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="clarity-focus flex w-full items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-primary"
          >
            <Plus className="size-3.5" aria-hidden />
            Create in {title.toLowerCase()}
          </button>
        )}
      </div>
    </section>
  );
}
