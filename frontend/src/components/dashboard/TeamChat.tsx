import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

interface TeamChatProps {
  onOpenChat?: () => void;
}

/** Dashboard teaser that routes into the full Chat surface. */
export function TeamChat({ onOpenChat }: TeamChatProps) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-accent text-primary">
            <MessageCircle className="size-3.5" aria-hidden />
          </span>
          <h2 className="text-[13px] font-semibold text-card-foreground">Team chat</h2>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-5 py-5">
        <p className="text-[12px] leading-5 text-muted-light">
          Channels live with your active team. Open Chat to read the thread, create
          channels, and send messages.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-fit"
          onClick={onOpenChat}
        >
          <Send className="size-3.5" aria-hidden />
          Open chat
        </Button>
      </div>
    </Panel>
  );
}
