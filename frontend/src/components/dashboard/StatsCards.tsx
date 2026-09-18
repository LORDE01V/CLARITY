import { CalendarDays, GitPullRequest, SquareCheckBig } from "lucide-react";

interface StatsCardsProps {
  /** Live open-task count (todo + in_progress) from the active team. */
  openTasksCount?: number;
  tasksLoading?: boolean;
  meetingsTodayCount?: number;
  openPrsCount?: number;
}

export function StatsCards({
  openTasksCount = 0,
  tasksLoading,
  meetingsTodayCount = 0,
  openPrsCount,
}: StatsCardsProps) {
  const cards = [
    {
      label: "Open tasks",
      value: tasksLoading ? "..." : String(openTasksCount),
      badge: "open",
      badgeTone: "bg-accent text-primary",
      hint: "todo + in progress",
      icon: SquareCheckBig,
    },
    {
      label: "Meetings today",
      value: String(meetingsTodayCount),
      badge: meetingsTodayCount > 0 ? "live" : "none",
      badgeTone: "bg-secondary text-secondary-foreground",
      hint: "from your team calendar",
      icon: CalendarDays,
    },
    {
      label: "Open PRs",
      value: openPrsCount == null ? "—" : String(openPrsCount),
      badge: openPrsCount == null ? "live" : `${openPrsCount}`,
      badgeTone: "bg-[#f7ebdb] text-chart-3",
      hint:
        openPrsCount == null
          ? "from GitHub webhooks when connected"
          : "recent PR events",
      icon: GitPullRequest,
    },
  ];

  return (
    <div className="mb-7 grid gap-3 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
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
                {card.value}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold tabular-nums ${card.badgeTone}`}
              >
                {card.badge}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-muted-light">{card.hint}</p>
          </div>
        );
      })}
    </div>
  );
}
