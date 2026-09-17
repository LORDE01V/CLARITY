import { Video } from "lucide-react";
import type { TeamMeeting } from "@/types";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface UpcomingMeetingsProps {
  meetings: TeamMeeting[];
  loading: boolean;
  hasTeam: boolean;
  onJoin: (meeting: TeamMeeting) => void;
  onCreate: () => void;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function UpcomingMeetings({
  meetings,
  loading,
  hasTeam,
  onJoin,
  onCreate,
}: UpcomingMeetingsProps) {
  const live = meetings.filter((m) => m.status !== "ended").slice(0, 6);
  const recent = meetings.slice(0, 6);

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <SectionHeader title="Meetings" />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCreate}
          disabled={!hasTeam}
        >
          New
        </Button>
      </div>
      <div className="flex flex-col gap-1 p-3">
        {!hasTeam ? (
          <p className="px-2 py-4 text-[12px] text-muted-light">
            Join a workspace to start Jitsi meetings.
          </p>
        ) : loading ? (
          <p className="px-2 py-4 text-[12px] text-muted-light">Loading…</p>
        ) : recent.length === 0 ? (
          <div className="px-2 py-4">
            <p className="text-[12px] text-muted-light">
              No meetings yet. Start one to auto-create a Jitsi room.
            </p>
            <Button type="button" variant="primary" size="sm" className="mt-3" onClick={onCreate}>
              Start meeting
            </Button>
          </div>
        ) : (
          (live.length > 0 ? live : recent).map((meeting) => (
            <button
              key={meeting.id}
              type="button"
              onClick={() => onJoin(meeting)}
              className="clarity-row clarity-focus flex items-center gap-3 rounded-lg px-2 py-3 text-left"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <Video className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-text-body">
                  {meeting.title}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-light">
                  {meeting.status === "live" ? "Live" : meeting.status} ·{" "}
                  {formatWhen(meeting.started_at)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </Panel>
  );
}
