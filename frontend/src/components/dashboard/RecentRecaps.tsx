import { ChevronRight } from "lucide-react";
import { RECAPS } from "@/data/dashboard";
import { Avatar } from "@/components/ui/Avatar";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface RecentRecapsProps {
  onOpenRecap: () => void;
}

export function RecentRecaps({ onOpenRecap }: RecentRecapsProps) {
  return (
    <Panel>
      <div className="border-b border-border-subtle px-5 py-4">
        <SectionHeader title="Recent recaps to review" action="View all" />
      </div>
      <div className="flex flex-col">
        {RECAPS.map((recap) => (
          <button
            key={recap.title}
            type="button"
            onClick={onOpenRecap}
            className="clarity-row clarity-focus flex items-center gap-3 border-b border-border-subtle px-5 py-3.5 text-left last:border-b-0"
          >
            <Avatar
              initials={recap.initials}
              className={`shadow-card ${recap.color} ${recap.text}`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-text-body">
                {recap.title}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-light">{recap.meta}</p>
            </div>
            <span className="hidden rounded-full bg-[var(--badge-neutral)] px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm sm:block">
              Drafted by AI · awaiting review
            </span>
            <ChevronRight className="size-4 text-[var(--text-icon-muted)]" />
          </button>
        ))}
      </div>
    </Panel>
  );
}
