import { Bell, Plus, Search } from "lucide-react";
import type { AuthUser } from "@/types";
import { Button } from "@/components/ui/Button";

interface DashboardHeaderProps {
  user: AuthUser;
  orgName?: string;
  teamName?: string;
  onNewMeeting: () => void;
}

function getGreetingName(user: AuthUser): string {
  return user.full_name?.split(" ")[0] ?? user.email.split("@")[0];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatToday(): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

export function DashboardHeader({
  user,
  orgName,
  teamName,
  onNewMeeting,
}: DashboardHeaderProps) {
  const firstName = getGreetingName(user);

  return (
    <header className="mb-8 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-card-foreground sm:text-[28px]">
          {getGreeting()}, {firstName}
        </h1>
        <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-muted-foreground">
          {formatToday()}.
          {orgName && teamName ? (
            <>
              {" "}
              Active workspace:{" "}
              <span className="font-medium text-text-body">
                {orgName} / {teamName}
              </span>
              .
            </>
          ) : (
            <> Here&apos;s what&apos;s happening across your workspace.</>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button type="button" aria-label="Search" className="clarity-icon-btn hidden sm:inline-flex">
          <Search className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="clarity-icon-btn hidden sm:inline-flex"
        >
          <Bell className="size-4" aria-hidden />
        </button>
        <Button type="button" variant="primary" size="sm" onClick={onNewMeeting}>
          <Plus className="size-4" aria-hidden />
          New meeting
        </Button>
      </div>
    </header>
  );
}
