import { useEffect, useRef, useState, type FormEvent } from "react";
import { Hash, Loader2, Plus, Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils";
import type { AuthUser, ChatChannel, ChatMessage } from "@/types";

interface ChatPanelProps {
  channels: ChatChannel[];
  activeChannel: ChatChannel | null;
  messages: ChatMessage[];
  hasMore: boolean;
  loadingChannels: boolean;
  loadingMessages: boolean;
  sending: boolean;
  error: string | null;
  isDemo: boolean;
  hasTeam: boolean;
  currentUser: AuthUser;
  onSelectChannel: (channelId: string) => void;
  onCreateChannel: (name: string, description?: string) => Promise<void>;
  onSend: (body: string) => Promise<void>;
  onLoadOlder: () => Promise<void>;
  onClearError: () => void;
}

function initialsFromMessage(message: ChatMessage): string {
  const source = message.author_name?.trim() || message.author_email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function ChatPanel({
  channels,
  activeChannel,
  messages,
  hasMore,
  loadingChannels,
  loadingMessages,
  sending,
  error,
  isDemo,
  hasTeam,
  currentUser,
  onSelectChannel,
  onCreateChannel,
  onSend,
  onLoadOlder,
  onClearError,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    if (stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeChannel?.id]);

  const displayError = localError ?? error;

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setLocalError(null);
    stickToBottom.current = true;
    try {
      await onSend(body);
      setDraft("");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not send message");
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setLocalError(null);
    try {
      await onCreateChannel(name);
      setNewName("");
      setCreating(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not create channel");
    }
  }

  async function handleLoadOlder() {
    setLoadingOlder(true);
    stickToBottom.current = false;
    try {
      await onLoadOlder();
    } finally {
      setLoadingOlder(false);
    }
  }

  if (!hasTeam) {
    return (
      <Panel className="px-5 py-8">
        <SectionHeader title="Chat" />
        <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted-light">
          Select or create a team workspace before opening chat.
        </p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-card-foreground">
            Chat
          </h1>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-light">
            Team channels for the active workspace
            {isDemo ? " · demo mode" : ""}.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setCreating((v) => !v)}
        >
          <Plus className="size-3.5" aria-hidden />
          New channel
        </Button>
      </div>

      {displayError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--border-warm)] bg-[#fbf6f0] px-4 py-3 text-[12px] text-text-body"
        >
          <span>{displayError}</span>
          <button
            type="button"
            className="text-[11px] font-semibold text-primary"
            onClick={() => {
              setLocalError(null);
              onClearError();
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {creating && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="flex flex-wrap items-end gap-3 border-b border-border-subtle pb-4"
        >
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-light">
              Channel name
            </span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="design-critique"
              className="clarity-focus h-11 rounded-[var(--radius-sm)] border border-border bg-card px-3 text-[13px] text-text-body outline-none placeholder:text-[var(--text-placeholder)]"
              autoFocus
            />
          </label>
          <Button type="submit" size="sm" disabled={!newName.trim()}>
            Create
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
          >
            Cancel
          </Button>
        </form>
      )}

      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="flex flex-col border-r-0 lg:border-r lg:border-border-subtle lg:pr-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-light">
            Channels
          </p>
          {loadingChannels ? (
            <div className="flex items-center gap-2 py-6 text-[12px] text-muted-light">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : channels.length === 0 ? (
            <p className="py-6 text-[12px] text-muted-light">No channels yet.</p>
          ) : (
            <ul className="flex flex-row gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {channels.map((channel) => {
                const active = channel.id === activeChannel?.id;
                return (
                  <li key={channel.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectChannel(channel.id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "clarity-focus flex w-full min-h-10 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-left text-[13px] font-medium transition-colors",
                        active
                          ? "bg-accent text-primary"
                          : "text-secondary-foreground hover:bg-secondary"
                      )}
                    >
                      <Hash className="size-3.5 shrink-0 opacity-70" aria-hidden />
                      <span className="truncate">{channel.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <Panel className="flex min-h-[520px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-accent text-primary">
                  <Hash className="size-3.5" aria-hidden />
                </span>
                <h2 className="truncate text-[14px] font-semibold text-card-foreground">
                  {activeChannel?.name ?? "Select a channel"}
                </h2>
              </div>
              {activeChannel?.description && (
                <p className="mt-1 truncate text-[11px] text-muted-light">
                  {activeChannel.description}
                </p>
              )}
            </div>
            {!isDemo && (
              <span className="shrink-0 text-[10px] font-medium text-muted-light">
                Updates every few seconds
              </span>
            )}
          </div>

          <div
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4"
            onScroll={(e) => {
              const el = e.currentTarget;
              stickToBottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
          >
            {hasMore && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={loadingOlder}
                  onClick={() => void handleLoadOlder()}
                >
                  {loadingOlder ? "Loading…" : "Load earlier messages"}
                </Button>
              </div>
            )}

            {loadingMessages ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-[12px] text-muted-light">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading messages…
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <p className="text-[13px] font-medium text-text-body">
                  No messages yet
                </p>
                <p className="max-w-sm text-[12px] text-muted-light">
                  Start the thread for #{activeChannel?.name ?? "this channel"}.
                </p>
              </div>
            ) : (
              messages.map((message, index) => {
                const prev = messages[index - 1];
                const showDay =
                  !prev ||
                  formatDay(prev.created_at) !== formatDay(message.created_at);
                const mine = message.author_id === currentUser.id;
                return (
                  <div key={message.id}>
                    {showDay && (
                      <p className="mb-3 mt-1 text-center text-[10px] font-medium uppercase tracking-[0.06em] text-muted-light">
                        {formatDay(message.created_at)}
                      </p>
                    )}
                    <div className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
                      <Avatar
                        initials={initialsFromMessage(message)}
                        className={
                          mine
                            ? "bg-accent text-primary"
                            : "bg-secondary text-secondary-foreground"
                        }
                      />
                      <div className={cn("max-w-[85%] sm:max-w-[70%]", mine && "text-right")}>
                        <div
                          className={cn(
                            "flex items-baseline gap-2",
                            mine && "flex-row-reverse"
                          )}
                        >
                          <span className="text-[11px] font-semibold text-text-body">
                            {mine
                              ? "You"
                              : message.author_name || message.author_email}
                          </span>
                          <span className="text-[10px] text-[var(--text-placeholder)]">
                            {formatTime(message.created_at)}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "mt-1 px-3 py-2 text-[12px] leading-5 text-text-chat",
                            mine
                              ? "rounded-l-lg rounded-br-lg bg-accent text-text-body"
                              : "rounded-r-lg rounded-bl-lg bg-chat-bubble"
                          )}
                        >
                          {message.body}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => void handleSend(e)}
            className="flex items-center gap-2 border-t border-border-subtle px-4 py-3"
          >
            <input
              aria-label={
                activeChannel
                  ? `Message #${activeChannel.name}`
                  : "Message channel"
              }
              placeholder={
                activeChannel
                  ? `Message #${activeChannel.name}`
                  : "Select a channel first"
              }
              value={draft}
              disabled={!activeChannel || sending}
              onChange={(e) => setDraft(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-text-body outline-none placeholder:text-[var(--text-placeholder)] disabled:opacity-50"
            />
            <Button
              type="submit"
              variant="primary"
              size="icon"
              aria-label="Send message"
              disabled={!activeChannel || !draft.trim() || sending}
            >
              {sending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Send className="size-3.5" aria-hidden />
              )}
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
