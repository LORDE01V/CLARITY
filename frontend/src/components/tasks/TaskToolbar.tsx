import { Search, UserRound, CalendarClock, X } from "lucide-react";
import { DEMO_PEOPLE, type TaskPerson } from "@/lib/tasks/display";
import { cn } from "@/lib/utils";

export type BoardFilter = "all" | "mine" | "unassigned" | "overdue";

interface TaskToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  filter: BoardFilter;
  onFilterChange: (value: BoardFilter) => void;
  assigneeId: string | null;
  onAssigneeChange: (id: string | null) => void;
  people: TaskPerson[];
  currentUserId?: string | null;
  total: number;
  visible: number;
  isDemo: boolean;
}

const FILTERS: { id: BoardFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "unassigned", label: "Unassigned" },
  { id: "overdue", label: "Overdue" },
];

export function TaskToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  assigneeId,
  onAssigneeChange,
  people,
  total,
  visible,
  isDemo,
}: TaskToolbarProps) {
  const roster = people.length > 0 ? people : DEMO_PEOPLE;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-light"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search title, key, or description"
            className="clarity-input min-h-11 pl-10 pr-10 text-[13px]"
            aria-label="Search board"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="clarity-focus absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-card-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>

        <p className="text-[12px] tabular-nums text-muted-foreground">
          {visible === total ? (
            <>
              <span className="font-semibold text-card-foreground">{total}</span> on
              board
            </>
          ) : (
            <>
              Showing{" "}
              <span className="font-semibold text-card-foreground">{visible}</span> of{" "}
              {total}
            </>
          )}
          {isDemo && (
            <span className="ml-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              Demo board
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Board filters"
        >
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              className={cn(
                "clarity-focus inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-2 text-[12px] font-medium transition-colors",
                filter === item.id
                  ? "bg-primary text-primary-foreground shadow-button"
                  : "bg-card text-muted-foreground shadow-card hover:bg-secondary hover:text-card-foreground"
              )}
            >
              {item.id === "mine" && <UserRound className="size-3.5" aria-hidden />}
              {item.id === "overdue" && (
                <CalendarClock className="size-3.5" aria-hidden />
              )}
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Assignee filter">
          <button
            type="button"
            onClick={() => onAssigneeChange(null)}
            className={cn(
              "clarity-focus rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[11px] font-medium",
              assigneeId == null
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:bg-secondary"
            )}
          >
            Anyone
          </button>
          {roster.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() =>
                onAssigneeChange(assigneeId === person.id ? null : person.id)
              }
              title={person.name}
              className={cn(
                "clarity-focus flex size-8 items-center justify-center rounded-full text-[10px] font-semibold transition-shadow",
                assigneeId === person.id
                  ? "bg-primary text-primary-foreground shadow-button ring-2 ring-primary/30"
                  : "bg-accent text-primary hover:ring-2 hover:ring-primary/20"
              )}
              aria-pressed={assigneeId === person.id}
              aria-label={`Filter by ${person.name}`}
            >
              {person.initials}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
