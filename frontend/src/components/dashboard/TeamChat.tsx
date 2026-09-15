import { MessageCircle, Paperclip, Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

const MESSAGES = [
  {
    initials: "MC",
    name: "Maya Chen",
    time: "10:52 AM",
    text: "I've added the activation notes to the recap. Would love a second pair of eyes.",
    color: "bg-[#e0f1f2] text-primary",
  },
  {
    initials: "JW",
    name: "James Wilson",
    time: "10:55 AM",
    text: "On it. I'll share the funnel cut before lunch.",
    color: "bg-[#f7ebdb] text-chart-3",
  },
];

export function TeamChat() {
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-accent text-primary">
            <MessageCircle className="size-3.5" />
          </span>
          <h2 className="text-[13px] font-semibold text-card-foreground">Team chat</h2>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-primary">
          <span className="size-1.5 rounded-full bg-primary" />
          Live
        </span>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {MESSAGES.map((message) => (
          <div key={message.name} className="flex gap-2.5">
            <Avatar initials={message.initials} className={message.color} />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-semibold text-text-body">
                  {message.name}
                </span>
                <span className="text-[10px] text-[var(--text-placeholder)]">
                  {message.time}
                </span>
              </div>
              <p className="mt-1 rounded-r-lg rounded-bl-lg bg-chat-bubble px-3 py-2 text-[11px] leading-5 text-text-chat">
                {message.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-border-subtle px-4 py-3">
        <button
          type="button"
          aria-label="Attach file"
          className="text-muted-light hover:text-primary"
        >
          <Paperclip className="size-4" />
        </button>
        <input
          aria-label="Message team"
          placeholder="Message #product-updates"
          className="min-w-0 flex-1 bg-transparent text-[11px] text-text-body outline-none placeholder:text-[var(--text-placeholder)]"
        />
        <Button type="button" variant="primary" size="icon" aria-label="Send message">
          <Send className="size-3.5" />
        </Button>
      </div>
    </Panel>
  );
}
