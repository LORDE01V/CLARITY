import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import type { ChatMessage } from "@/types";

interface TeamChatProps {
  messages?: ChatMessage[];
  loading?: boolean;
  hasTeam?: boolean;
  channelName?: string | null;
  onOpenChat?: () => void;
}

function previewAuthor(message: ChatMessage): string {
  return (
    message.author?.full_name?.trim() ||
    message.author?.email?.split("@")[0] ||
    "Teammate"
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Dashboard teaser: latest channel messages + jump into full Chat. */
export function TeamChat({
  messages = [],
  loading = false,
  hasTeam = false,
  channelName,
  onOpenChat,
}: TeamChatProps) {
  const recent = messages.slice(-4).reverse();

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-accent text-primary">
            <MessageCircle className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-card-foreground">Team chat</h2>
            {channelName && (
              <p className="truncate text-[10px] text-muted-light">#{channelName}</p>
            )}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenChat}>
          Open
        </Button>
      </div>

      <div className="flex flex-col gap-1 px-3 py-3">
        {!hasTeam ? (
          <p className="px-2 py-3 text-[12px] text-muted-light">
            Join a workspace to use team chat.
          </p>
        ) : loading && recent.length === 0 ? (
          <p className="px-2 py-3 text-[12px] text-muted-light">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="px-2 py-3 text-[12px] leading-5 text-muted-light">
            No messages yet. Open Chat to start the thread — updates show here too.
          </p>
        ) : (
          recent.map((message) => (
            <button
              key={message.id}
              type="button"
              onClick={onOpenChat}
              className="clarity-row clarity-focus rounded-lg px-2 py-2.5 text-left"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-[11px] font-semibold text-text-body">
                  {previewAuthor(message)}
                </p>
                <span className="shrink-0 text-[10px] text-muted-light">
                  {relativeTime(message.created_at)}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-light">
                {message.body}
              </p>
            </button>
          ))
        )}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2 w-fit"
          onClick={onOpenChat}
          disabled={!hasTeam}
        >
          <Send className="size-3.5" aria-hidden />
          {recent.length > 0 ? "Continue in Chat" : "Open chat"}
        </Button>
      </div>
    </Panel>
  );
}
