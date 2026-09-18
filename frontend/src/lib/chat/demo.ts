/**
 * Offline chat stubs — empty only. Never seed fake teammates or messages.
 */

import type {
  ChatChannel,
  ChatChannelCreate,
  ChatDirectMessageCreate,
  ChatGroupCreate,
  ChatMessage,
  ChatMessageCreate,
  ChatMessagePage,
} from "@/types/chat";
import type { TeamMemberWithUser } from "@/types/team";

const channelsByTeam = new Map<string, ChatChannel[]>();
const messagesByChannel = new Map<string, ChatMessage[]>();

function nowIso(): string {
  return new Date().toISOString();
}

function id(): string {
  return crypto.randomUUID();
}

function sortChannels(channels: ChatChannel[]): ChatChannel[] {
  const order = { channel: 0, dm: 1, group: 2 } as const;
  return [...channels].sort(
    (a, b) =>
      order[a.channel_type] - order[b.channel_type] ||
      Number(b.is_default) - Number(a.is_default) ||
      a.name.localeCompare(b.name)
  );
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
      channel_type: "channel",
      created_by: userId,
      created_at: nowIso(),
      members: [],
    };
    channels = [general];
    channelsByTeam.set(teamId, channels);
    messagesByChannel.set(general.id, []);
  }
  return channels;
}

export function listDemoTeamMembers(
  teamId: string,
  currentUser: { id: string; email: string; full_name?: string | null }
): TeamMemberWithUser[] {
  return [
    {
      id: "local-self",
      team_id: teamId,
      user_id: currentUser.id,
      role: "owner",
      joined_at: nowIso(),
      email: currentUser.email,
      full_name: currentUser.full_name ?? null,
    },
  ];
}

export function listDemoChannels(teamId: string, userId: string): ChatChannel[] {
  return sortChannels(ensureGeneral(teamId, userId));
}

export function createDemoChannel(
  teamId: string,
  userId: string,
  payload: ChatChannelCreate
): ChatChannel {
  const channels = ensureGeneral(teamId, userId);
  const name = payload.name.trim().toLowerCase().replace(/\s+/g, "-");
  if (channels.some((c) => c.channel_type === "channel" && c.name === name)) {
    throw new Error("A channel with that name already exists");
  }
  const channel: ChatChannel = {
    id: id(),
    team_id: teamId,
    name,
    description: payload.description ?? null,
    is_default: false,
    channel_type: "channel",
    created_by: userId,
    created_at: nowIso(),
    members: [],
  };
  channels.push(channel);
  channelsByTeam.set(teamId, sortChannels(channels));
  messagesByChannel.set(channel.id, []);
  return channel;
}

export function startDemoDm(
  teamId: string,
  currentUser: { id: string; email: string; full_name?: string | null },
  payload: ChatDirectMessageCreate
): ChatChannel {
  const channels = ensureGeneral(teamId, currentUser.id);
  const roster = listDemoTeamMembers(teamId, currentUser);
  const peer = roster.find((m) => m.user_id === payload.user_id);
  if (!peer || peer.user_id === currentUser.id) {
    throw new Error("Recipient must be a member of this team");
  }

  const existing = channels.find(
    (c) =>
      c.channel_type === "dm" &&
      c.members.some((m) => m.user_id === currentUser.id) &&
      c.members.some((m) => m.user_id === payload.user_id)
  );
  if (existing) return existing;

  const channel: ChatChannel = {
    id: id(),
    team_id: teamId,
    name: peer.full_name?.trim() || peer.email,
    description: null,
    is_default: false,
    channel_type: "dm",
    created_by: currentUser.id,
    created_at: nowIso(),
    members: [
      {
        user_id: currentUser.id,
        email: currentUser.email,
        full_name: currentUser.full_name ?? null,
      },
      {
        user_id: peer.user_id,
        email: peer.email,
        full_name: peer.full_name,
      },
    ],
  };
  channels.push(channel);
  channelsByTeam.set(teamId, sortChannels(channels));
  messagesByChannel.set(channel.id, []);
  return channel;
}

export function createDemoGroup(
  teamId: string,
  currentUser: { id: string; email: string; full_name?: string | null },
  payload: ChatGroupCreate
): ChatChannel {
  const channels = ensureGeneral(teamId, currentUser.id);
  const name = payload.name.trim();
  if (!name) throw new Error("Group name cannot be empty");
  const roster = listDemoTeamMembers(teamId, currentUser);
  const others = payload.member_ids
    .filter((uid) => uid !== currentUser.id)
    .map((uid) => roster.find((m) => m.user_id === uid))
    .filter(Boolean) as TeamMemberWithUser[];
  if (others.length === 0) {
    throw new Error("Group requires at least one other member");
  }

  const channel: ChatChannel = {
    id: id(),
    team_id: teamId,
    name,
    description: null,
    is_default: false,
    channel_type: "group",
    created_by: currentUser.id,
    created_at: nowIso(),
    members: [
      {
        user_id: currentUser.id,
        email: currentUser.email,
        full_name: currentUser.full_name ?? null,
      },
      ...others.map((m) => ({
        user_id: m.user_id,
        email: m.email,
        full_name: m.full_name,
      })),
    ],
  };
  channels.push(channel);
  channelsByTeam.set(teamId, sortChannels(channels));
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
