import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Hash, Loader2, MessageSquare, Plus, Send, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils";
import {
  conversationTitle,
  type AuthUser,
  type ChatChannel,
  type ChatMessage,
  type TeamMemberWithUser,
} from "@/types";

interface ChatPanelProps {
  channels: ChatChannel[];
  members: TeamMemberWithUser[];
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
  onStartDm: (userId: string) => Promise<void>;
  onCreateGroup: (name: string, memberIds: string[]) => Promise<void>;
  onSend: (body: string) => Promise<void>;
  onLoadOlder: () => Promise<void>;
  onClearError: () => void;
}

type ComposeMode = "channel" | "dm" | "group" | null;

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

function ConversationIcon({ type }: { type: ChatChannel["channel_type"] }) {
  if (type === "dm") {
    return <MessageSquare className="size-3.5 shrink-0 opacity-70" aria-hidden />;
  }
  if (type === "group") {
    return <Users className="size-3.5 shrink-0 opacity-70" aria-hidden />;
  }
  return <Hash className="size-3.5 shrink-0 opacity-70" aria-hidden />;
}

function ConversationList({
  title,
  items,
  activeId,
  currentUserId,
  onSelect,
}: {
  title: string;
  items: ChatChannel[];
  activeId: string | null | undefined;
  currentUserId: string;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-light">
        {title}
      </p>
      <ul className="flex flex-row gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((channel) => {
          const active = channel.id === activeId;
          const label = conversationTitle(channel, currentUserId);
          return (
            <li key={channel.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(channel.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "clarity-focus flex w-full min-h-10 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-left text-[13px] font-medium transition-colors",
                  active
                    ? "bg-accent text-primary"
                    : "text-secondary-foreground hover:bg-secondary"
                )}
              >
                <ConversationIcon type={channel.channel_type} />
                <span className="truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChatPanel({
  channels,
  members,
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
  onStartDm,
  onCreateGroup,
  onSend,
  onLoadOlder,
  onClearError,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [composeMode, setComposeMode] = useState<ComposeMode>(null);
  const [newName, setNewName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const broadcastChannels = useMemo(
    () => channels.filter((c) => c.channel_type === "channel"),
    [channels]
  );
  const directChannels = useMemo(
    () => channels.filter((c) => c.channel_type === "dm"),
    [channels]
  );
  const groupChannels = useMemo(
    () => channels.filter((c) => c.channel_type === "group"),
    [channels]
  );

  const selectableMembers = useMemo(
    () => members.filter((m) => m.user_id !== currentUser.id),
    [members, currentUser.id]
  );

  useEffect(() => {
    if (stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeChannel?.id]);

  const displayError = localError ?? error;
  const headerTitle = activeChannel
    ? conversationTitle(activeChannel, currentUser.id)
    : "Select a conversation";

  function resetCompose() {
    setComposeMode(null);
    setNewName("");
    setGroupName("");
    setSelectedMemberIds([]);
  }

  function toggleMember(userId: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

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

  async function handleCreateChannel(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setLocalError(null);
    try {
      await onCreateChannel(name);
      resetCompose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not create channel");
    }
  }

  async function handleStartDm(userId: string) {
    setLocalError(null);
    try {
      await onStartDm(userId);
      resetCompose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not start direct message");
    }
  }

  async function handleCreateGroup(event: FormEvent) {
    event.preventDefault();
    const name = groupName.trim();
    if (!name || selectedMemberIds.length === 0) return;
    setLocalError(null);
    try {
      await onCreateGroup(name, selectedMemberIds);
      resetCompose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not create group");
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

  const placeholder =
    activeChannel?.channel_type === "dm"
      ? `Message ${headerTitle}`
      : activeChannel?.channel_type === "group"
        ? `Message ${headerTitle}`
        : activeChannel
          ? `Message #${activeChannel.name}`
          : "Select a conversation first";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-card-foreground">
            Chat
          </h1>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-light">
            Channels, direct messages, and groups for the active workspace
            {isDemo ? " · demo mode" : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setComposeMode((v) => (v === "channel" ? null : "channel"))
            }
          >
            <Plus className="size-3.5" aria-hidden />
            New channel
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setComposeMode((v) => (v === "dm" ? null : "dm"))}
          >
            <MessageSquare className="size-3.5" aria-hidden />
            New message
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setComposeMode((v) => (v === "group" ? null : "group"))
            }
          >
            <Users className="size-3.5" aria-hidden />
            New group
          </Button>
        </div>
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

      {composeMode === "channel" && (
        <form
          onSubmit={(e) => void handleCreateChannel(e)}
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
          <Button type="button" variant="ghost" size="sm" onClick={resetCompose}>
            Cancel
          </Button>
        </form>
      )}

      {composeMode === "dm" && (
        <div className="border-b border-border-subtle pb-4">
          <p className="mb-2 text-[11px] font-medium text-muted-light">
            Message a teammate
          </p>
          {selectableMembers.length === 0 ? (
            <p className="text-[12px] text-muted-light">
              No other team members yet. Invite someone from Team, then start a
              DM here.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {selectableMembers.map((member) => (
                <li key={member.user_id}>
                  <button
                    type="button"
                    onClick={() => void handleStartDm(member.user_id)}
                    className="clarity-focus flex w-full min-h-10 items-center justify-between rounded-[var(--radius-sm)] px-3 text-left text-[13px] hover:bg-secondary"
                  >
                    <span className="font-medium text-text-body">
                      {member.full_name?.trim() || member.email}
                    </span>
                    <span className="text-[11px] text-muted-light">
                      {member.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <Button type="button" variant="ghost" size="sm" onClick={resetCompose}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {composeMode === "group" && (
        <form
          onSubmit={(e) => void handleCreateGroup(e)}
          className="flex flex-col gap-3 border-b border-border-subtle pb-4"
        >
          <label className="flex max-w-md flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-light">
              Group name
            </span>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Launch crew"
              className="clarity-focus h-11 rounded-[var(--radius-sm)] border border-border bg-card px-3 text-[13px] text-text-body outline-none placeholder:text-[var(--text-placeholder)]"
              autoFocus
            />
          </label>
          <div>
            <p className="mb-2 text-[11px] font-medium text-muted-light">
              Members
            </p>
            {selectableMembers.length === 0 ? (
              <p className="text-[12px] text-muted-light">
                Invite teammates before creating a group.
              </p>
            ) : (
              <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {selectableMembers.map((member) => {
                  const checked = selectedMemberIds.includes(member.user_id);
                  return (
                    <li key={member.user_id}>
                      <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] px-3 text-[13px] hover:bg-secondary">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(member.user_id)}
                          className="size-4 accent-[var(--primary)]"
                        />
                        <span className="font-medium text-text-body">
                          {member.full_name?.trim() || member.email}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={!groupName.trim() || selectedMemberIds.length === 0}
            >
              Create group
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={resetCompose}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="flex flex-col border-r-0 lg:border-r lg:border-border-subtle lg:pr-4">
          {loadingChannels ? (
            <div className="flex items-center gap-2 py-6 text-[12px] text-muted-light">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : channels.length === 0 ? (
            <p className="py-6 text-[12px] text-muted-light">No conversations yet.</p>
          ) : (
            <>
              <ConversationList
                title="Channels"
                items={broadcastChannels}
                activeId={activeChannel?.id}
                currentUserId={currentUser.id}
                onSelect={onSelectChannel}
              />
              <ConversationList
                title="Direct"
                items={directChannels}
                activeId={activeChannel?.id}
                currentUserId={currentUser.id}
                onSelect={onSelectChannel}
              />
              <ConversationList
                title="Groups"
                items={groupChannels}
                activeId={activeChannel?.id}
                currentUserId={currentUser.id}
                onSelect={onSelectChannel}
              />
            </>
          )}
        </aside>

        <Panel className="flex min-h-[520px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-accent text-primary">
                  {activeChannel ? (
                    <ConversationIcon type={activeChannel.channel_type} />
                  ) : (
                    <Hash className="size-3.5" aria-hidden />
                  )}
                </span>
                <h2 className="truncate text-[14px] font-semibold text-card-foreground">
                  {headerTitle}
                </h2>
              </div>
              {activeChannel?.channel_type === "channel" &&
                activeChannel.description && (
                  <p className="mt-1 truncate text-[11px] text-muted-light">
                    {activeChannel.description}
                  </p>
                )}
              {activeChannel?.channel_type === "group" && (
                <p className="mt-1 truncate text-[11px] text-muted-light">
                  {activeChannel.members
                    .map((m) => m.full_name?.trim() || m.email)
                    .join(", ")}
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
                  Start the thread for {headerTitle}.
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
              aria-label={placeholder}
              placeholder={placeholder}
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
