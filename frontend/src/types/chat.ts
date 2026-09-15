export type ChatChannelType = "channel" | "dm" | "group";

export interface ChatChannelMember {
  user_id: string;
  email: string;
  full_name: string | null;
}

export interface ChatChannel {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  channel_type: ChatChannelType;
  created_by: string;
  created_at: string;
  members: ChatChannelMember[];
}

export interface ChatChannelCreate {
  name: string;
  description?: string | null;
}

export interface ChatDirectMessageCreate {
  user_id: string;
}

export interface ChatGroupCreate {
  name: string;
  member_ids: string[];
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  author_id: string;
  author_email: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

export interface ChatMessageCreate {
  body: string;
}

export interface ChatMessagePage {
  messages: ChatMessage[];
  has_more: boolean;
}

/** Display title for sidebar / header (DM shows the other person). */
export function conversationTitle(
  channel: ChatChannel,
  currentUserId: string
): string {
  if (channel.channel_type === "dm") {
    const other = channel.members.find((m) => m.user_id !== currentUserId);
    if (other) return other.full_name?.trim() || other.email;
  }
  return channel.name;
}
