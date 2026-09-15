import { Video } from "lucide-react";
import { MEETINGS } from "@/data/dashboard";
import { Avatar } from "@/components/ui/Avatar";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";

export function UpcomingMeetings() {
  return (
    <Panel>
      <div className="border-b border-border-subtle px-5 py-4">
        <SectionHeader title="Upcoming meetings" action="Calendar" />
      </div>
      <div className="flex flex-col gap-1 p-3">
        {MEETINGS.map((meeting) => (
          <div
            key={meeting.title}
            className="clarity-row flex items-center gap-3 rounded-lg px-2 py-3"
          >
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${meeting.tone} text-white`}
            >
              <Video className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-text-body">
                {meeting.title}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-light">{meeting.time}</p>
            </div>
            <div className="flex -space-x-1.5">
              {meeting.avatars.slice(0, 3).map((initials) => (
                <Avatar
                  key={initials}
                  initials={initials}
                  className="size-6 border-2 border-white bg-secondary text-[8px] text-secondary-foreground"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
