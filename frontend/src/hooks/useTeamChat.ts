/**
 * Loads team chat conversations and messages; polls for new messages.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { api, ApiError } from "@/lib/api";
import {
  createDemoChannel,
  createDemoGroup,
  listDemoChannels,
  listDemoMessages,
  listDemoTeamMembers,
  sendDemoMessage,
  startDemoDm,
} from "@/lib/chat/demo";
import type {
  ChatChannel,
  ChatChannelCreate,
  ChatDirectMessageCreate,
  ChatGroupCreate,
  ChatMessage,
  ChatMessageCreate,
  TeamMemberWithUser,
} from "@/types";

const POLL_MS = 4000;

function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return typeof err.message === "string" ? err.message : fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

function sortConversations(channels: ChatChannel[]): ChatChannel[] {
  const order = { channel: 0, dm: 1, group: 2 } as const;
  return [...channels].sort(
    (a, b) =>
      order[a.channel_type] - order[b.channel_type] ||
      Number(b.is_default) - Number(a.is_default) ||
      a.name.localeCompare(b.name)
  );
}

export function useTeamChat() {
  const { user, isBypassMode } = useAuth();
  const { team } = useWorkspace();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [members, setMembers] = useState<TeamMemberWithUser[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestCreatedAt = useRef<string | null>(null);
  const pollBusy = useRef(false);

  const teamId = team?.id ?? null;
  const userId = user?.id ?? "demo-user";

  const refreshChannels = useCallback(async () => {
    if (!teamId) {
      setChannels([]);
      setMembers([]);
      setActiveChannelId(null);
      setMessages([]);
      setLoadingChannels(false);
      return;
    }

    setLoadingChannels(true);
    setError(null);
    try {
      if (isBypassMode) {
        const demoUser = user ?? {
          id: userId,
          email: "demo@clarity.local",
          full_name: "Demo User",
        };
        setChannels(listDemoChannels(teamId, userId));
        setMembers(listDemoTeamMembers(teamId, demoUser));
      } else {
        const [next, roster] = await Promise.all([
          api.chat.listChannels(teamId),
          api.teams.listMembers(teamId),
        ]);
        setChannels(next);
        setMembers(roster);
      }
    } catch (err) {
      setChannels([]);
      setMembers([]);
      setError(formatError(err, "Could not load conversations"));
    } finally {
      setLoadingChannels(false);
    }
  }, [teamId, isBypassMode, userId, user]);

  useEffect(() => {
    setActiveChannelId((prev) => {
      if (prev && channels.some((c) => c.id === prev)) return prev;
      return channels.find((c) => c.is_default)?.id ?? channels[0]?.id ?? null;
    });
  }, [channels]);

  const loadMessages = useCallback(
    async (channelId: string) => {
      if (!teamId) return;
      setLoadingMessages(true);
      setError(null);
      try {
        const page = isBypassMode
          ? listDemoMessages(channelId, { limit: 50 })
          : await api.chat.listMessages(teamId, channelId, { limit: 50 });
        setMessages(page.messages);
        setHasMore(page.has_more);
        latestCreatedAt.current =
          page.messages[page.messages.length - 1]?.created_at ?? null;
      } catch (err) {
        setMessages([]);
        setHasMore(false);
        setError(formatError(err, "Could not load messages"));
      } finally {
        setLoadingMessages(false);
      }
    },
    [teamId, isBypassMode]
  );

  const loadOlder = useCallback(async () => {
    if (!teamId || !activeChannelId || !messages[0] || !hasMore) return;
    try {
      const page = isBypassMode
        ? listDemoMessages(activeChannelId, {
            limit: 50,
            before: messages[0].created_at,
          })
        : await api.chat.listMessages(teamId, activeChannelId, {
            limit: 50,
            before: messages[0].created_at,
          });
      setMessages((prev) => [...page.messages, ...prev]);
      setHasMore(page.has_more);
    } catch (err) {
      setError(formatError(err, "Could not load older messages"));
    }
  }, [teamId, activeChannelId, messages, hasMore, isBypassMode]);

  useEffect(() => {
    void refreshChannels();
  }, [refreshChannels]);

  useEffect(() => {
    if (!activeChannelId) {
      setMessages([]);
      latestCreatedAt.current = null;
      return;
    }
    void loadMessages(activeChannelId);
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    if (!teamId || !activeChannelId || isBypassMode) return;

    const tick = async () => {
      if (pollBusy.current || !latestCreatedAt.current) return;
      pollBusy.current = true;
      try {
        const page = await api.chat.listMessages(teamId, activeChannelId, {
          after: latestCreatedAt.current,
          limit: 50,
        });
        if (page.messages.length > 0) {
          setMessages((prev) => {
            const known = new Set(prev.map((m) => m.id));
            const fresh = page.messages.filter((m) => !known.has(m.id));
            if (fresh.length === 0) return prev;
            return [...prev, ...fresh];
          });
          latestCreatedAt.current =
            page.messages[page.messages.length - 1]?.created_at ??
            latestCreatedAt.current;
        }
      } catch {
        // Keep silent on poll failures; primary errors surface on load/send.
      } finally {
        pollBusy.current = false;
      }
    };

    const handle = window.setInterval(() => {
      void tick();
    }, POLL_MS);
    return () => window.clearInterval(handle);
  }, [teamId, activeChannelId, isBypassMode]);

  const upsertChannel = useCallback((created: ChatChannel) => {
    setChannels((prev) => {
      const without = prev.filter((c) => c.id !== created.id);
      return sortConversations([...without, created]);
    });
    setActiveChannelId(created.id);
  }, []);

  const createChannel = useCallback(
    async (payload: ChatChannelCreate) => {
      if (!teamId) throw new Error("No active team");
      const created = isBypassMode
        ? createDemoChannel(teamId, userId, payload)
        : await api.chat.createChannel(teamId, payload);
      upsertChannel(created);
      return created;
    },
    [teamId, isBypassMode, userId, upsertChannel]
  );

  const startDm = useCallback(
    async (payload: ChatDirectMessageCreate) => {
      if (!teamId) throw new Error("No active team");
      if (!user) throw new Error("You must be signed in");
      const created = isBypassMode
        ? startDemoDm(teamId, user, payload)
        : await api.chat.startDm(teamId, payload);
      upsertChannel(created);
      return created;
    },
    [teamId, isBypassMode, user, upsertChannel]
  );

  const createGroup = useCallback(
    async (payload: ChatGroupCreate) => {
      if (!teamId) throw new Error("No active team");
      if (!user) throw new Error("You must be signed in");
      const created = isBypassMode
        ? createDemoGroup(teamId, user, payload)
        : await api.chat.createGroup(teamId, payload);
      upsertChannel(created);
      return created;
    },
    [teamId, isBypassMode, user, upsertChannel]
  );

  const sendMessage = useCallback(
    async (payload: ChatMessageCreate) => {
      if (!teamId || !activeChannelId) throw new Error("No active channel");
      if (!user) throw new Error("You must be signed in");
      setSending(true);
      setError(null);
      try {
        const created = isBypassMode
          ? sendDemoMessage(activeChannelId, user, payload)
          : await api.chat.sendMessage(teamId, activeChannelId, payload);
        setMessages((prev) => {
          if (prev.some((m) => m.id === created.id)) return prev;
          return [...prev, created];
        });
        latestCreatedAt.current = created.created_at;
        return created;
      } catch (err) {
        setError(formatError(err, "Could not send message"));
        throw err;
      } finally {
        setSending(false);
      }
    },
    [teamId, activeChannelId, user, isBypassMode]
  );

  const selectChannel = useCallback((channelId: string) => {
    setActiveChannelId(channelId);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const activeChannel =
    channels.find((c) => c.id === activeChannelId) ?? null;

  return {
    channels,
    members,
    activeChannel,
    activeChannelId,
    messages,
    hasMore,
    loadingChannels,
    loadingMessages,
    sending,
    error,
    isDemo: isBypassMode,
    hasTeam: Boolean(teamId),
    selectChannel,
    createChannel,
    startDm,
    createGroup,
    sendMessage,
    loadOlder,
    refreshChannels,
    clearError,
  };
}
