/**
 * In-memory chat store for auth-bypass demo mode.
 */

import type {
  ChatChannel,
  ChatChannelCreate,
  ChatMessage,
  ChatMessageCreate,
  ChatMessagePage,
} from "@/types/chat";

const channelsByTeam = new Map<string, ChatChannel[]>();
const messagesByChannel = new Map<string, ChatMessage[]>();

function nowIso(): string {
  return new Date().toISOString();
}

function id(): string {
  return crypto.randomUUID();
}

function ensureGeneral(teamId: string, userId: string): ChatChannel[] {
  let channels = channelsByTeam.get(teamId);
  if (!channels) {
    const general: ChatChannel = {
      id: id(),
      team_id: teamId,
      name: "general",
      description: "Default team channel",
      is_default: true,
      created_by: userId,
      created_at: nowIso(),
    };
    channels = [general];
    channelsByTeam.set(teamId, channels);
    messagesByChannel.set(general.id, [
      {
        id: id(),
        channel_id: general.id,
        author_id: userId,
        author_email: "demo@clarity.local",
        author_name: "Demo User",
        body: "Welcome to team chat. Messages stay in demo mode until you sign in.",
        created_at: nowIso(),
      },
    ]);
  }
  return channels;
}

export function listDemoChannels(teamId: string, userId: string): ChatChannel[] {
  return ensureGeneral(teamId, userId);
}

export function createDemoChannel(
  teamId: string,
  userId: string,
  payload: ChatChannelCreate
): ChatChannel {
  const channels = ensureGeneral(teamId, userId);
  const name = payload.name.trim().toLowerCase().replace(/\s+/g, "-");
  if (channels.some((c) => c.name === name)) {
    throw new Error("A channel with that name already exists");
  }
  const channel: ChatChannel = {
    id: id(),
    team_id: teamId,
    name,
    description: payload.description ?? null,
    is_default: false,
    created_by: userId,
    created_at: nowIso(),
  };
  channels.push(channel);
  channelsByTeam.set(
    teamId,
    [...channels].sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name))
  );
  messagesByChannel.set(channel.id, []);
  return channel;
}

export function listDemoMessages(
  channelId: string,
  opts: { limit?: number; before?: string; after?: string } = {}
): ChatMessagePage {
  const all = messagesByChannel.get(channelId) ?? [];
  const limit = opts.limit ?? 50;
  let filtered = all;

  if (opts.after) {
    const afterTs = Date.parse(opts.after);
    filtered = all.filter((m) => Date.parse(m.created_at) > afterTs);
    return { messages: filtered.slice(0, limit), has_more: false };
  }

  if (opts.before) {
    const beforeTs = Date.parse(opts.before);
    filtered = all.filter((m) => Date.parse(m.created_at) < beforeTs);
  }

  const slice = filtered.slice(-limit);
  const has_more =
    filtered.length > 0 &&
    all.some((m) => Date.parse(m.created_at) < Date.parse(slice[0]?.created_at ?? ""));
  return { messages: slice, has_more };
}

export function sendDemoMessage(
  channelId: string,
  user: { id: string; email: string; full_name?: string | null },
  payload: ChatMessageCreate
): ChatMessage {
  const messages = messagesByChannel.get(channelId) ?? [];
  const message: ChatMessage = {
    id: id(),
    channel_id: channelId,
    author_id: user.id,
    author_email: user.email,
    author_name: user.full_name ?? null,
    body: payload.body.trim(),
    created_at: nowIso(),
  };
  messages.push(message);
  messagesByChannel.set(channelId, messages);
  return message;
}
