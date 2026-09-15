import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[13px] font-semibold text-card-foreground">{title}</h2>
      {action && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAction}
          className="h-auto gap-1 px-0 py-0 text-[11px] font-medium text-muted-foreground hover:bg-transparent hover:text-primary"
        >
          {action}
          <ChevronRight className="size-3" />
        </Button>
      )}
    </div>
  );
}
