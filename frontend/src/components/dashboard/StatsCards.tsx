import { STAT_CARDS } from "@/data/dashboard";

interface StatsCardsProps {
  /** Live open-task count (todo + in_progress) from the active team. */
  openTasksCount?: number;
  tasksLoading?: boolean;
}

export function StatsCards({ openTasksCount, tasksLoading }: StatsCardsProps) {
  return (
    <div className="mb-7 grid gap-3 sm:grid-cols-3">
      {STAT_CARDS.map((card) => {
        const Icon = card.icon;
        const isOpenTasks = card.label === "Open tasks";
        const value =
          isOpenTasks && openTasksCount != null
            ? tasksLoading
              ? "..."
              : String(openTasksCount)
            : card.value;
        const badge = isOpenTasks && openTasksCount != null ? "open" : card.badge;
        const badgeTone =
          isOpenTasks && openTasksCount != null
            ? "bg-accent text-primary"
            : card.badgeTone;
        const hint =
          isOpenTasks && openTasksCount != null
            ? "todo + in progress"
            : card.hint;

        return (
          <div key={card.label} className="clarity-stat-card">
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                {card.label}
              </span>
              <Icon className="size-4 shrink-0 text-muted-light" aria-hidden />
            </div>
            <div className="flex items-end justify-between gap-2">
              <span className="text-2xl font-semibold tabular-nums tracking-[-0.04em] text-card-foreground">
                {value}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold tabular-nums ${badgeTone}`}
              >
                {badge}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-muted-light">{hint}</p>
          </div>
        );
      })}
    </div>
  );
}
